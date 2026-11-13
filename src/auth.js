import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "./db.js";
import { sendRecoveryMail, sendMail } from "./mail.js";
import { isPasswordLongEnough } from "./password-policy.js";

const scrypt = promisify(scryptCallback);
const sessionDays = 30;
export const ADMIN_EMAIL = "cstaudygaming@googlemail.com";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isAdminEmail(value) {
  return normalizeEmail(value) === ADMIN_EMAIL;
}

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return scrypt(String(password), salt, 64).then(key => `scrypt$${salt}$${Buffer.from(key).toString("hex")}`);
}

async function verifyPassword(password, stored) {
  const [scheme, salt, expectedHex] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = Buffer.from(await scrypt(String(password), salt, 64));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function sessionFromRequest(req) {
  const raw = String(req.headers.cookie || "");
  const row = raw.split(";").map(x => x.trim()).find(x => x.startsWith("cfs_session="));
  return row ? row.slice("cfs_session=".length) : "";
}

export async function register({ email, password, display_name }) {
  const pool = getPool();
  if (!pool) return { error: "DATABASE_UNAVAILABLE", status: 503 };
  const normalized = normalizeEmail(email);
  const name = String(display_name || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) return { error: "INVALID_EMAIL", status: 400 };
  if (!isPasswordLongEnough(password)) return { error: "PASSWORD_TOO_SHORT", status: 400 };
  if (name.length < 2 || name.length > 80) return { error: "INVALID_DISPLAY_NAME", status: 400 };
  const hash = await passwordHash(password);
  try {
    const result = await pool.query("insert into accounts (email, password_hash, display_name) values ($1, $2, $3) returning id, email, display_name, role, plan, created_at", [normalized, hash, name]);
    return { account: result.rows[0] };
  } catch (error) {
    if (error.code === "23505") return { error: "EMAIL_ALREADY_REGISTERED", status: 409 };
    throw error;
  }
}

export async function login({ email, password }) {
  const pool = getPool();
  if (!pool) return { error: "DATABASE_UNAVAILABLE", status: 503 };
  const result = await pool.query("select id, email, display_name, role, plan, password_hash, created_at from accounts where email = $1", [normalizeEmail(email)]);
  const account = result.rows[0];
  if (!account || !account.password_hash || !(await verifyPassword(password, account.password_hash))) return { error: "INVALID_CREDENTIALS", status: 401 };
  const secondFactor = (await pool.query("select enabled, recovery_codes from account_mfa where account_id=$1", [account.id])).rows[0];
  if (secondFactor?.enabled === true) {
    // Each password login consumes one per-account allowance regardless of the
    // caller IP, and the quota is committed atomically in PostgreSQL.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const allowance = (await client.query(`
        update account_mfa set
          login_challenge_window_count = case
            when login_challenge_window_started_at is null
              or login_challenge_window_started_at <= now() - interval '15 minutes'
              then 1
            else login_challenge_window_count + 1 end,
          login_challenge_window_started_at = case
            when login_challenge_window_started_at is null
              or login_challenge_window_started_at <= now() - interval '15 minutes'
              then now()
            else login_challenge_window_started_at end
        where account_id=$1 and enabled=true and
          (login_challenge_window_started_at is null
           or login_challenge_window_started_at <= now() - interval '15 minutes'
           or login_challenge_window_count < 8)
        returning recovery_codes`, [account.id])).rows[0];
      if (!allowance) {
        await client.query("ROLLBACK");
        return { error: "MFA_CHALLENGE_RATE_LIMITED", status: 429 };
      }
      const pendingToken = randomBytes(32).toString("base64url");
      // Do not reset earlier challenges: invalidating them on each password
      // login would let another party disrupt an existing second-factor flow.
      await client.query(
        "insert into mfa_login_challenges(token_hash,account_id,expires_at) values($1,$2,now()+interval '10 minutes')",
        [tokenHash(pendingToken), account.id]
      );
      await client.query("COMMIT");
      return {
        mfa_required: true,
        mfa_methods: { totp: true, recovery: Array.isArray(allowance.recovery_codes) && allowance.recovery_codes.length > 0, passkey: false },
        pendingToken,
        pendingMaxAge: 600
      };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
  const token = randomBytes(32).toString("base64url");
  await pool.query("insert into sessions (account_id, token_hash, expires_at) values ($1, $2, now() + ($3 || ' days')::interval)", [account.id, tokenHash(token), String(sessionDays)]);
  delete account.password_hash;
  account.role = isAdminEmail(account.email) ? "admin" : "creator";
  return { account, token, maxAge: sessionDays * 86400 };
}

export async function currentAccount(req) {
  const token = sessionFromRequest(req);
  const pool = getPool();
  if (!token || !pool) return null;
  const result = await pool.query("select a.id, a.email, a.display_name, a.role, a.plan, a.email_verified_at, a.created_at from sessions s join accounts a on a.id = s.account_id where s.token_hash = $1 and s.expires_at > now()", [tokenHash(token)]);
  if (!result.rows[0]) return null;
  await pool.query("update sessions set last_seen_at = now() where token_hash = $1", [tokenHash(token)]);
  const account = result.rows[0];
  account.role = isAdminEmail(account.email) ? "admin" : "creator";
  return account;
}

export async function logout(req) {
  const token = sessionFromRequest(req);
  const pool = getPool();
  if (token && pool) await pool.query("delete from sessions where token_hash = $1", [tokenHash(token)]);
  return cookie("cfs_session", "", 0);
}

export async function requestPasswordReset(email) {
  const pool=getPool(); const normalized=normalizeEmail(email); const generic={ok:true,message:"Wenn ein passendes Konto existiert, wurde ein Recovery-Link angefordert."};
  const row=(await pool.query("select id,email from accounts where email=$1",[normalized])).rows[0]; if(!row)return generic;
  const token=randomBytes(32).toString("base64url"); await pool.query("delete from password_recovery_tokens where account_id=$1 or expires_at<=now()",[row.id]); await pool.query("insert into password_recovery_tokens(account_id,token_hash,expires_at) values($1,$2,now()+interval '30 minutes')",[row.id,tokenHash(token)]); await sendRecoveryMail({to:row.email,token}); return generic;
}
export async function resetPassword(token, newPassword) {
  if (!isPasswordLongEnough(newPassword)) return { error: "PASSWORD_TOO_SHORT", status: 400 };
  if (typeof token !== "string" || token.length > 512 || !token) return { error: "RECOVERY_TOKEN_INVALID_OR_EXPIRED", status: 400 };
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Consume the token atomically: concurrent reset requests cannot reuse it.
    const consumed = (await client.query(
      "update password_recovery_tokens set used_at=now() where token_hash=$1 and used_at is null and expires_at>now() returning account_id",
      [tokenHash(token)]
    )).rows[0];
    if (!consumed) {
      await client.query("ROLLBACK");
      return { error: "RECOVERY_TOKEN_INVALID_OR_EXPIRED", status: 400 };
    }
    const hash = await passwordHash(newPassword);
    await client.query("update accounts set password_hash=$2,updated_at=now() where id=$1", [consumed.account_id, hash]);
    await client.query("delete from sessions where account_id=$1", [consumed.account_id]);
    await client.query("delete from mfa_login_challenges where account_id=$1", [consumed.account_id]);
    await client.query("COMMIT");
    return { ok: true, message: "Passwort wurde zurückgesetzt." };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
export async function requestEmailVerification(email){const normalized=normalizeEmail(email),pool=getPool(),row=(await pool.query("select id,email from accounts where email=$1",[normalized])).rows[0];if(!row)return{ok:true,message:"Wenn ein passendes Konto existiert, wurde ein Bestätigungslink angefordert."};const token=randomBytes(32).toString("base64url");await pool.query("delete from email_verification_tokens where account_id=$1 or expires_at<=now()",[row.id]);await pool.query("insert into email_verification_tokens(account_id,token_hash,expires_at) values($1,$2,now()+interval '30 minutes')",[row.id,tokenHash(token)]);await sendMail({to:row.email,token,type:"verification"});return{ok:true,message:"Bestätigungslink wurde angefordert."};}
export async function verifyEmail(token) {
  if (typeof token !== "string" || !token || token.length > 512) return { error: "VERIFICATION_TOKEN_INVALID_OR_EXPIRED", status: 400 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const consumed = (await client.query(
      "update email_verification_tokens set used_at=now() where token_hash=$1 and used_at is null and expires_at>now() returning account_id",
      [tokenHash(token)]
    )).rows[0];
    if (!consumed) {
      await client.query("ROLLBACK");
      return { error: "VERIFICATION_TOKEN_INVALID_OR_EXPIRED", status: 400 };
    }
    await client.query("update accounts set email_verified_at=now(),updated_at=now() where id=$1", [consumed.account_id]);
    await client.query("COMMIT");
    return { ok: true, message: "E-Mail-Adresse wurde bestätigt." };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
export async function updateProfile(req,body){const account=await currentAccount(req);if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};const name=String(body.display_name||"").trim();if(name.length<2||name.length>80)return{error:"INVALID_DISPLAY_NAME",status:400};const row=(await getPool().query("update accounts set display_name=$2,updated_at=now() where id=$1 returning id,email,display_name,role,plan,email_verified_at,created_at",[account.id,name])).rows[0];return{ok:true,account:row};}
export async function verifyAccountPassword(req,password){const account=await currentAccount(req);if(!account)return null;const row=(await getPool().query("select password_hash from accounts where id=$1",[account.id])).rows[0];return row&&await verifyPassword(password,row.password_hash)?account:null;}
export async function changePassword(req, body) {
  const account = await currentAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!isPasswordLongEnough(body?.new_password)) return { error: "PASSWORD_TOO_SHORT", status: 400 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent password changes for this account.
    const row = (await client.query("select password_hash from accounts where id=$1 for update", [account.id])).rows[0];
    if (!row || !(await verifyPassword(body?.current_password, row.password_hash))) {
      await client.query("ROLLBACK");
      return { error: "INVALID_CURRENT_PASSWORD", status: 401 };
    }
    const hash = await passwordHash(body.new_password);
    await client.query("update accounts set password_hash=$2,updated_at=now() where id=$1", [account.id, hash]);
    await client.query("delete from sessions where account_id=$1", [account.id]);
    await client.query("delete from mfa_login_challenges where account_id=$1", [account.id]);
    await client.query("COMMIT");
    return { ok: true, message: "Passwort wurde geändert. Alle Sitzungen wurden beendet. Bitte erneut anmelden." };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
export async function listSessions(req){const account=await currentAccount(req);if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};const current=tokenHash(sessionFromRequest(req)),rows=(await getPool().query("select id,token_hash,created_at,expires_at,last_seen_at from sessions where account_id=$1 and expires_at>now() order by last_seen_at desc",[account.id])).rows;return{ok:true,sessions:rows.map(row=>({id:row.id,current:row.token_hash===current,created_at:row.created_at,expires_at:row.expires_at,last_seen_at:row.last_seen_at,auth_method:"password"}))};}
export async function logoutAll(req){const account=await currentAccount(req);if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};await getPool().query("delete from sessions where account_id=$1",[account.id]);await getPool().query("delete from mfa_login_challenges where account_id=$1",[account.id]);return{ok:true};}
export async function exportAccount(req,password){const account=await verifyAccountPassword(req,password);if(!account)return{error:"INVALID_CURRENT_PASSWORD",status:401};const pool=getPool(),id=account.id;const projects=(await pool.query("select id,kind,name,data,status,created_at,updated_at from creator_projects where account_id=$1",[id])).rows,devices=(await pool.query("select id,machine_name,client_version,status,last_seen_at,created_at,updated_at from launcher_devices where account_id=$1",[id])).rows,media=(await pool.query("select id,folder,name,mime_type,size_bytes,duration_ms,metadata,created_at,updated_at from user_media where account_id=$1",[id])).rows;return{ok:true,export:{account:{id:account.id,email:account.email,display_name:account.display_name,plan:account.plan,created_at:account.created_at},projects,launcher_devices:devices,user_media:media,exported_at:new Date().toISOString()}};}
export async function deleteAccount(req,body){const account=await verifyAccountPassword(req,body.password);if(!account)return{error:"INVALID_CURRENT_PASSWORD",status:401};if(String(body.confirmation||"").trim().toUpperCase()!=="LÖSCHEN")return{error:"DELETE_CONFIRMATION_REQUIRED",status:400};await getPool().query("delete from accounts where id=$1",[account.id]);return{ok:true};}

export { cookie };
