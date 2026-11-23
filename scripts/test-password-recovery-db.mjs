import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import pg from "pg";

const ciUrl = "postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/cfs_ci";
if (process.env.CFS_CI_DATABASE_ACCEPTANCE !== "yes" || process.env.DATABASE_URL !== ciUrl) {
  throw new Error("REFUSED: password-recovery integration requires the disposable CI database.");
}

process.env.DATABASE_SSL = "false";
process.env.SESSION_SECRET = "ci-password-recovery-secret-only";
process.env.RESEND_API_KEY = "ci-resend-token-only";
process.env.MAIL_FROM = "no-reply@example.test";
process.env.APP_BASE_URL = "https://cfs-zockt.example";

const { register, login, requestPasswordReset, resetPassword } = await import("../src/auth.js");
const { getPool, closeDatabase } = await import("../src/db.js");
const admin = new pg.Client({ connectionString: ciUrl, ssl: false });
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `recovery-${suffix}@example.test`;
const secondEmail = `recovery-provider-${suffix}@example.test`;
const parallelEmail = `recovery-parallel-${suffix}@example.test`;
const ip = "203.0.113.10";
let sent = [];
globalThis.fetch = async (_url, options) => {
  sent.push(JSON.parse(options.body));
  return { ok: true };
};

function tokenFromLastMail() {
  const match = String(sent.at(-1)?.html || "").match(/#token=([^<]+)/);
  assert(match, "synthetic provider mail must contain a fragment token");
  return decodeURIComponent(match[1]);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

await admin.connect();
try {
  await admin.query("delete from accounts where email = any($1::text[])", [[email, secondEmail, parallelEmail]]);
  const created = await register({ email, password: "Old secure password 123!", display_name: "Recovery CI" });
  assert(created.account?.id, "synthetic recovery account must be created");

  const loggedIn = await login({ email, password: "Old secure password 123!" });
  assert(loggedIn.token, "pre-reset session must exist");
  const unknown = await requestPasswordReset(`missing-${suffix}@example.test`, ip);
  assert.equal(unknown.ok, true);
  assert.equal(sent.length, 0, "unknown account must not trigger mail");

  await requestPasswordReset(email, ip);
  const token = tokenFromLastMail();
  const pool = getPool();
  assert.equal((await pool.query("select count(*) from password_recovery_tokens where token_hash=$1 and expires_at>now()", [hash(token)])).rows[0].count, "1", "provider token must be persisted and unexpired");
  await pool.query(
    "insert into mfa_login_challenges(token_hash,account_id,expires_at) values($1,$2,now()+interval '10 minutes')",
    [hash(`challenge-${suffix}`), created.account.id]
  );
  const reset = await resetPassword(token, "New secure password 456!");
  assert.equal(reset.ok, true, `reset failed: ${JSON.stringify(reset)}`);
  assert.equal((await pool.query("select count(*) from sessions where account_id=$1", [created.account.id])).rows[0].count, "0");
  assert.equal((await pool.query("select count(*) from mfa_login_challenges where account_id=$1", [created.account.id])).rows[0].count, "0");
  assert.equal((await resetPassword(token, "Another secure password 789!")).error, "RECOVERY_TOKEN_INVALID_OR_EXPIRED");
  assert((await login({ email, password: "New secure password 456!" })).token, "new password must work");

  const providerAccount = await register({ email: secondEmail, password: "Provider secure password 123!", display_name: "Provider CI" });
  globalThis.fetch = async () => ({ ok: false });
  await requestPasswordReset(secondEmail, "203.0.113.11");
  assert.equal((await pool.query("select count(*) from password_recovery_tokens where account_id=$1", [providerAccount.account.id])).rows[0].count, "0", "provider failure must not leave a usable token");

  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return { ok: true }; };
  const parallelAccount = await register({ email: parallelEmail, password: "Parallel secure password 123!", display_name: "Parallel CI" });
  await requestPasswordReset(parallelEmail, "203.0.113.12");
  const parallelToken = tokenFromLastMail();
  const parallelResults = await Promise.all([
    resetPassword(parallelToken, "Parallel new password 123!"),
    resetPassword(parallelToken, "Parallel new password 456!")
  ]);
  assert.equal(parallelResults.filter(result => result.ok).length, 1, "a recovery token must be single-use under concurrency");

  const rateAccount = await register({ email: `recovery-rate-${suffix}@example.test`, password: "Rate secure password 123!", display_name: "Rate CI" });
  const beforeRate = sent.length;
  for (let i = 0; i < 6; i++) await requestPasswordReset(rateAccount.account.email, "203.0.113.13");
  assert.equal(sent.length - beforeRate, 5, "account recovery requests must be capped at five per window");
  console.log("Password recovery PostgreSQL integration passed: neutral unknown-user response, token single-use, concurrent reset serialization, session/MFA invalidation, provider failure cleanup and account rate limit.");
} finally {
  await admin.query("delete from accounts where email like $1", [`%${suffix}@example.test`]);
  await admin.end();
  await closeDatabase();
}
