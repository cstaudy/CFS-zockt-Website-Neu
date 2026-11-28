import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { register, login, resetPassword, changePassword } from "../src/auth.js";
import { closeDatabase, getPool } from "../src/db.js";

// This is a positive PostgreSQL-18 acceptance test. It is deliberately limited
// to a disposable local CI database and can never target staging or production.
const databaseUrl = process.env.DATABASE_URL || "";
let host = "";
try { host = new URL(databaseUrl).hostname; } catch {}
if (process.env.CFS_CI_DATABASE_ACCEPTANCE !== "yes" ||
    !["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error("Auth concurrency test blocked: requires explicit opt-in and a local disposable PostgreSQL database.");
}

const pool = getPool();
if (!pool) throw new Error("DATABASE_URL fehlt.");
const email = `auth-concurrency-${randomUUID()}@example.test`;
const initialPassword = "ci-auth-initial-password-long";
const resetPasswordOne = "ci-auth-reset-password-one-long";
const resetPasswordTwo = "ci-auth-reset-password-two-long";
const changedPasswordOne = "ci-auth-changed-password-one-long";
const changedPasswordTwo = "ci-auth-changed-password-two-long";
const hash = token => createHash("sha256").update(token).digest("hex");

try {
  const created = await register({ email, password: initialPassword, display_name: "PG18 Auth Race" });
  assert(created.account?.id, "Synthetic account was not created");

  const recoveryToken = "ci-recovery-token-" + randomUUID();
  await pool.query(
    "insert into password_recovery_tokens(account_id,token_hash,expires_at) values($1,$2,now()+interval '30 minutes')",
    [created.account.id, hash(recoveryToken)]
  );
  const recoveryResults = await Promise.all([
    resetPassword(recoveryToken, resetPasswordOne, pool),
    resetPassword(recoveryToken, resetPasswordTwo, pool)
  ]);
  assert.equal(recoveryResults.filter(result => result.ok === true).length, 1,
    "Exactly one concurrent recovery reset may consume a token");
  assert.equal(recoveryResults.filter(result => result.error === "RECOVERY_TOKEN_INVALID_OR_EXPIRED").length, 1,
    "The losing recovery reset must fail closed");
  const used = (await pool.query(
    "select used_at from password_recovery_tokens where token_hash=$1", [hash(recoveryToken)]
  )).rows[0];
  assert(used?.used_at, "The consumed recovery token must be marked used");

  // The two candidate passwords are distinguished by a real login, not by
  // test-side bookkeeping of the transaction winner.
  const loginOne = await login({ email, password: resetPasswordOne });
  const loginTwo = await login({ email, password: resetPasswordTwo });
  assert.equal(Boolean(loginOne.token) || Boolean(loginTwo.token), true,
    "The winning recovery password must authenticate");
  assert.equal(Boolean(loginOne.token) && Boolean(loginTwo.token), false,
    "The losing recovery password must not authenticate");
  const winningLogin = loginOne.token ? loginOne : loginTwo;
  const request = { headers: { cookie: `cfs_session=${winningLogin.token}` } };

  const changeResults = await Promise.all([
    changePassword(request, { current_password: loginOne.token ? resetPasswordOne : resetPasswordTwo, new_password: changedPasswordOne }),
    changePassword(request, { current_password: loginOne.token ? resetPasswordOne : resetPasswordTwo, new_password: changedPasswordTwo })
  ]);
  assert.equal(changeResults.filter(result => result.ok === true).length, 1,
    "Exactly one concurrent password change may pass the account lock");
  assert.equal(changeResults.filter(result => result.status === 401 &&
    ["INVALID_CURRENT_PASSWORD", "AUTHENTICATION_REQUIRED"].includes(result.error)).length, 1,
    "The losing password change must fail closed after the winner commits");

  const changeLoginOne = await login({ email, password: changedPasswordOne });
  const changeLoginTwo = await login({ email, password: changedPasswordTwo });
  assert.equal(Boolean(changeLoginOne.token) || Boolean(changeLoginTwo.token), true,
    "The winning password change must authenticate");
  assert.equal(Boolean(changeLoginOne.token) && Boolean(changeLoginTwo.token), false,
    "The losing password change must not authenticate");

  const expiredToken = "ci-expired-token-" + randomUUID();
  await pool.query(
    "insert into password_recovery_tokens(account_id,token_hash,expires_at) values($1,$2,now()-interval '1 second')",
    [created.account.id, hash(expiredToken)]
  );
  assert.deepEqual(await resetPassword(expiredToken, "ci-expired-password-long", pool),
    { error: "RECOVERY_TOKEN_INVALID_OR_EXPIRED", status: 400 });

  console.log("PG18 auth concurrency: recovery token one-time use, password-change serialization and expiry passed; MFA/launcher races remain covered by test-account-creator-flow.mjs.");
} finally {
  await pool.query("delete from accounts where email=$1", [email]).catch(() => {});
  await closeDatabase();
}
