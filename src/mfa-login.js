import { createHash, randomBytes } from "node:crypto";
import { getPool } from "./db.js";
import { isAdminEmail } from "./auth.js";
import { matchingTotpStep } from "./totp.js";
import { consumeRecoveryCode } from "./recovery-codes.js";

const pendingCookie = "cfs_mfa_pending";
const sessionDays = 30;
const sha256 = value => createHash("sha256").update(value).digest("hex");

export function pendingMfaToken(req) {
  const cookie = String(req.headers?.cookie || "").split(";")
    .map(value => value.trim()).find(value => value.startsWith(pendingCookie + "="));
  const token = cookie?.slice(pendingCookie.length + 1) || "";
  return /^[a-zA-Z0-9_-]{40,60}$/.test(token) ? token : "";
}

export const clearPendingMfaCookie = () =>
  `${pendingCookie}=; Max-Age=0; Path=/api/account/mfa/login; HttpOnly; Secure; SameSite=Strict`;

export function pendingMfaCookie(token) {
  return `${pendingCookie}=${token}; Max-Age=600; Path=/api/account/mfa/login; HttpOnly; Secure; SameSite=Strict`;
}

// The password is already verified, but no full session may exist until this
// transaction successfully consumes the single-use second-factor challenge.
export async function finishMfaLogin(req, body = {}) {
  const token = pendingMfaToken(req);
  if (!token) return { error: "MFA_CHALLENGE_INVALID_OR_EXPIRED", status: 401 };
  const inputCode = String(body?.code ?? "");
  const recovery = String(body?.recovery_code ?? "").trim().toUpperCase();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Read just enough to discover the account without taking a challenge
    // row lock. A concurrent MFA-disable locks account_mfa before deleting
    // challenges, so the lock ordering must be account_mfa -> challenge.
    const candidate = (await client.query(
      "select account_id from mfa_login_challenges where token_hash=$1 and expires_at>now()",
      [sha256(token)]
    )).rows[0];
    if (!candidate) {
      await client.query("ROLLBACK");
      return { error: "MFA_CHALLENGE_INVALID_OR_EXPIRED", status: 401 };
    }
    const settings = (await client.query(
      "select secret,recovery_codes,last_login_totp_step from account_mfa where account_id=$1 and enabled=true for update",
      [candidate.account_id]
    )).rows[0];
    if (!settings) {
      await client.query("ROLLBACK");
      return { error: "MFA_CHALLENGE_INVALID_OR_EXPIRED", status: 401 };
    }
    // Re-check the challenge AFTER locking the MFA settings. It may have been
    // consumed, expired or deleted since the first unprotected lookup.
    const challenge = (await client.query(
      "select token_hash,account_id,attempts from mfa_login_challenges where token_hash=$1 and account_id=$2 and expires_at>now() for update",
      [sha256(token), candidate.account_id]
    )).rows[0];
    if (!challenge || challenge.attempts >= 5) {
      await client.query("ROLLBACK");
      return { error: "MFA_CHALLENGE_INVALID_OR_EXPIRED", status: 401 };
    }
    const codes = Array.isArray(settings.recovery_codes) ? settings.recovery_codes : [];
    const matchedStep = matchingTotpStep(settings.secret, inputCode);
    const previouslyUsed = settings.last_login_totp_step === null
      ? null : Number(settings.last_login_totp_step);
    const totpValid = matchedStep !== null && (previouslyUsed === null || matchedStep > previouslyUsed);
    const recoveryResult = totpValid ? { valid: false, remaining: codes } : await consumeRecoveryCode(codes, recovery);
    const recoveryValid = recoveryResult.valid;
    if (!totpValid && !recoveryValid) {
      await client.query(
        "update mfa_login_challenges set attempts=attempts+1 where token_hash=$1",
        [sha256(token)]
      );
      await client.query("COMMIT");
      return { error: "MFA_CODE_INVALID", status: 401 };
    }
    if (totpValid) {
      // The MFA row remains locked through session creation and challenge
      // consumption. Another pending challenge cannot reuse this TOTP step.
      await client.query(
        "update account_mfa set last_login_totp_step=$2,updated_at=now() where account_id=$1",
        [challenge.account_id, matchedStep]
      );
    }
    if (recoveryValid) {
      const unused = recoveryResult.remaining;
      await client.query(
        "update account_mfa set recovery_codes=$2::jsonb,updated_at=now() where account_id=$1",
        [challenge.account_id, JSON.stringify(unused)]
      );
    }
    const account = (await client.query(
      "select id,email,display_name,role,plan,email_verified_at,created_at from accounts where id=$1",
      [challenge.account_id]
    )).rows[0];
    if (!account) throw new Error("MFA_ACCOUNT_MISSING");
    const sessionToken = randomBytes(32).toString("base64url");
    await client.query(
      "insert into sessions(account_id,token_hash,expires_at) values($1,$2,now()+interval '30 days')",
      [account.id, sha256(sessionToken)]
    );
    await client.query("delete from mfa_login_challenges where token_hash=$1", [sha256(token)]);
    await client.query("COMMIT");
    account.role = isAdminEmail(account.email) ? "admin" : "creator";
    return {
      authenticated: true, account, token: sessionToken,
      maxAge: sessionDays * 86400, recovery_code_used: Boolean(recoveryValid)
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
