import { createHash, randomBytes } from "node:crypto";
import { verifyTotp } from "./totp.js";
import { currentAccount, verifyAccountPassword, sessionFromRequest } from "./auth.js";
import { getPool } from "./db.js";
import { savePendingMfaSetup } from "./mfa-setup-guard.js";
import { generateRecoveryCodes, hashRecoveryCodes, verifyRecoveryCode } from "./recovery-codes.js";
const b32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(buf){let bits="";for(const x of buf)bits+=x.toString(2).padStart(8,"0");let out="";for(let i=0;i<bits.length;i+=5)out+=b32[parseInt(bits.slice(i,i+5).padEnd(5,"0"),2)];return out;}

async function account(req){const a=await currentAccount(req);return a||null;}
export async function mfaStatus(req){const a=await account(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const row=(await getPool().query("select enabled,enabled_at,recovery_codes from account_mfa where account_id=$1",[a.id])).rows[0];return{ok:true,enabled:Boolean(row?.enabled),enabled_at:row?.enabled_at||null,recovery_codes_remaining:Array.isArray(row?.recovery_codes)?row.recovery_codes.length:0};}
export async function mfaSetup(req,body){const a=await verifyAccountPassword(req,String(body?.password||""));if(!a)return{error:"INVALID_CURRENT_PASSWORD",status:401};const secret=base32(randomBytes(20));if (!await savePendingMfaSetup(getPool(), a.id, secret)) return { error: "MFA_ALREADY_ENABLED", status: 409 };return{ok:true,secret,otpauth_uri:`otpauth://totp/cfs_zockt:${encodeURIComponent(a.email)}?secret=${secret}&issuer=cfs_zockt`,message:"Secret in der Authenticator-App speichern und anschließend den 6-stelligen Code bestätigen."};}
export async function mfaEnable(req, body) {
  const a = await account(req);
  if (!a) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // An enabled MFA secret must never be re-enabled or rotated by a stale
    // activation request. Hold the lock through code verification and storage.
    const row = (await client.query(
      "select secret from account_mfa where account_id=$1 and enabled=false for update",
      [a.id]
    )).rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "MFA_SETUP_NOT_PENDING", status: 409 };
    }
    if (!verifyTotp(row.secret, body?.code)) {
      await client.query("ROLLBACK");
      return { error: "MFA_CODE_INVALID", status: 400 };
    }
    const recovery = generateRecoveryCodes();
    const stored = await hashRecoveryCodes(recovery);
    await client.query(
      "update account_mfa set enabled=true,enabled_at=now(),recovery_codes=$2::jsonb,recovery_rotated_at=null,updated_at=now() where account_id=$1",
      [a.id, JSON.stringify(stored)]
    );
    const sessionHash = createHash("sha256").update(sessionFromRequest(req)).digest("hex");
    await client.query("delete from sessions where account_id=$1 and token_hash<>$2", [a.id, sessionHash]);
    await client.query("delete from mfa_login_challenges where account_id=$1", [a.id]);
    await client.query("insert into account_security_events(account_id,event_type) values($1,'mfa_enabled')", [a.id]);
    await client.query("COMMIT");
    return { ok: true, recovery_codes: recovery, message: "MFA ist aktiviert. Speichere die Recovery-Codes sicher." };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
export async function mfaDisable(req, body) {
  const a = await account(req);
  if (!a) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serialize with concurrent MFA login/recovery and other disable requests.
    const row = (await client.query(
      "select secret,recovery_codes from account_mfa where account_id=$1 and enabled=true for update",
      [a.id]
    )).rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "MFA_NOT_ENABLED", status: 409 };
    }
    const valid = verifyTotp(row.secret, body?.code) ||
      await verifyRecoveryCode(row.recovery_codes, body?.recovery_code);
    if (!valid) {
      await client.query("ROLLBACK");
      return { error: "MFA_CODE_INVALID", status: 400 };
    }
    await client.query(
      "update account_mfa set enabled=false,recovery_codes='[]'::jsonb,updated_at=now() where account_id=$1",
      [a.id]
    );
    // A successful disable must also revoke pending MFA and all full sessions.
    await client.query("delete from mfa_login_challenges where account_id=$1", [a.id]);
    await client.query("delete from sessions where account_id=$1", [a.id]);
    await client.query("insert into account_security_events(account_id,event_type) values($1,'mfa_disabled')", [a.id]);
    await client.query("COMMIT");
    return { ok: true, message: "MFA wurde deaktiviert." };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
export async function mfaRecovery(req, body) {
  const a = await account(req);
  if (!a) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serializes rotation with login, disable and other rotation requests.
    const row = (await client.query(
      "select secret, (recovery_rotated_at > now() - interval '60 seconds') as rotation_cooldown from account_mfa where account_id=$1 and enabled=true for update",
      [a.id]
    )).rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "MFA_NOT_ENABLED", status: 409 };
    }
    if (!verifyTotp(row.secret, body?.code)) {
      await client.query("ROLLBACK");
      return { error: "MFA_CODE_INVALID", status: 400 };
    }
    // The locked row and database clock limit recovery rotations to once per minute.
    if (row.rotation_cooldown === true) {
      await client.query("ROLLBACK");
      return { error: "MFA_RECOVERY_ROTATION_TOO_SOON", status: 429 };
    }
    const recovery = generateRecoveryCodes();
    const stored = await hashRecoveryCodes(recovery);
    await client.query(
      "update account_mfa set recovery_codes=$2::jsonb,recovery_rotated_at=now(),updated_at=now() where account_id=$1",
      [a.id, JSON.stringify(stored)]
    );
    await client.query("insert into account_security_events(account_id,event_type) values($1,'mfa_recovery_rotated')", [a.id]);
    await client.query("COMMIT");
    return { ok: true, recovery_codes: recovery };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
