import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sendMail } from "../src/mail.js";
import { requestEmailVerification, verifyEmail } from "../src/email-verification.js";

const source = await readFile(new URL("../src/email-verification.js", import.meta.url), "utf8");
const authSource = await readFile(new URL("../src/auth.js", import.meta.url), "utf8");
const accountHtml = await readFile(new URL("../pages/account.html", import.meta.url), "utf8");
const accountJs = await readFile(new URL("../assets/js/page-account.js", import.meta.url), "utf8");
const verifyJs = await readFile(new URL("../assets/js/page-verify-email.js", import.meta.url), "utf8");
const shellSources = await Promise.all(["cfs-r14-shell.js", "cfs-r19-workspace.js", "cfs-shell-v3.js"].map(name => readFile(new URL(`../assets/js/${name}`, import.meta.url), "utf8")));
assert.match(source, /used_at is null and expires_at>now\(\)/);
assert.match(source, /update email_verification_tokens set used_at=now\(\)/);
assert.match(source, /await client\.query\("BEGIN"\)/);
assert.match(authSource, /export \{ requestEmailVerification, verifyEmail \} from "\.\/email-verification\.js";/);
assert.doesNotMatch(authSource, /delete from email_verification_tokens/);
assert.match(authSource, /update password_recovery_tokens set used_at=now\(\)/);
assert.match(authSource, /await client\.query\("BEGIN"\)/);
assert.match(accountHtml, /id="emailVerificationStatus"/);
assert.match(accountHtml, /id="requestVerificationBtn"[^>]*type="button"/);
assert.match(accountJs, /account\?\.email_verified/);
assert.match(accountJs, /\/api\/account\/email\/verification\/request/);
assert.match(verifyJs, /\/api\/account\/email\/verify/);
for (const shell of shellSources) assert.match(shell, /account\?\.admin/);
const savedFetch = globalThis.fetch;
const savedEnv = { ...process.env };
try {
  process.env.RESEND_API_KEY = "test-key";
  process.env.MAIL_FROM = "test@example.invalid";
  process.env.APP_BASE_URL = "https://cfs-zockt-staging.onrender.com/";
  globalThis.fetch = async () => ({ ok: false, status: 422 });
  assert.deepEqual(await sendMail({ to: "user@example.invalid", token: "test-token", type: "verification" }), { ok: false, error: "MAIL_DELIVERY_FAILED", status: 502 });
  globalThis.fetch = async (_url, options) => { assert.match(String(options.body), /verify-email\.html#token=test-token/); return { ok: true, status: 200 }; };
  assert.deepEqual(await sendMail({ to: "user@example.invalid", token: "test-token", type: "verification" }), { ok: true });
} finally {
  globalThis.fetch = savedFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
}
console.log("Email verification contract passed.");

class FakePool {
  constructor() { this.account = { id: "account-1", email: "owner@example.invalid", email_verified_at: null }; this.tokens = []; this.locked = false; this.waiters = []; }
  async connect() { return new FakeClient(this); }
  async lock() { if (!this.locked) { this.locked = true; return; } await new Promise(resolve => this.waiters.push(resolve)); this.locked = true; }
  unlock() { this.locked = false; this.waiters.shift()?.(); }
}
class FakeClient {
  constructor(pool) { this.pool = pool; this.inserted = null; }
  async query(sql, params = []) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized === "begin") return { rows: [] };
    if (normalized === "commit" || normalized === "rollback") {
      if (normalized === "rollback" && this.inserted) this.pool.tokens = this.pool.tokens.filter(token => token !== this.inserted);
      this.pool.unlock();
      return { rows: [] };
    }
    if (normalized.startsWith("select id,email,email_verified_at from accounts")) { await this.pool.lock(); return { rows: [this.pool.account] }; }
    if (normalized.startsWith("select 1 from email_verification_tokens")) {
      const recent = this.pool.tokens.some(token => !token.used && Date.now() - token.createdAt < 30000);
      return { rows: recent ? [{}] : [] };
    }
    if (normalized.startsWith("delete from email_verification_tokens")) { this.pool.tokens = this.pool.tokens.filter(token => token.accountId !== params[0]); return { rows: [] }; }
    if (normalized.startsWith("insert into email_verification_tokens")) {
      this.inserted = { accountId: params[0], tokenHash: params[1], createdAt: Date.now(), used: false, expiresAt: Date.now() + 1800000 };
      this.pool.tokens.push(this.inserted);
      return { rows: [] };
    }
    if (normalized.startsWith("update email_verification_tokens set used_at")) {
      const token = this.pool.tokens.find(item => item.tokenHash === params[0] && !item.used && item.expiresAt > Date.now());
      if (!token) return { rows: [] };
      token.used = true;
      return { rows: [{ account_id: token.accountId }] };
    }
    if (normalized.startsWith("update accounts set email_verified_at")) { this.pool.account.email_verified_at = new Date(); return { rows: [] }; }
    throw new Error(`Unhandled fake SQL: ${sql}`);
  }
  release() {}
}

const pool = new FakePool();
const requestBodies = [];
process.env.RESEND_API_KEY = "test-key";
process.env.MAIL_FROM = "test@example.invalid";
process.env.APP_BASE_URL = "https://cfs-zockt-staging.onrender.com/";
globalThis.fetch = async (_url, options) => {
  requestBodies.push(JSON.parse(options.body));
  await new Promise(resolve => setTimeout(resolve, 20));
  return { ok: true, status: 200 };
};
const parallelRequests = await Promise.all([
  requestEmailVerification(pool.account.email, pool),
  requestEmailVerification(pool.account.email, pool)
]);
assert.equal(parallelRequests.filter(result => result.ok === true).length, 1, "parallel resend requests must produce one successful send");
assert.equal(parallelRequests.filter(result => result.error === "VERIFICATION_RATE_LIMITED").length, 1, "parallel resend requests must rate-limit the loser");
assert.equal(requestBodies.length, 1, "parallel resend requests must not send two messages");

const sentToken = new URL(requestBodies[0].html.match(/#token=([^"<]+)/)[0].replace("#token=", "https://invalid/?token="), "https://invalid/").searchParams.get("token");
const parallelVerifications = await Promise.all([verifyEmail(sentToken, pool), verifyEmail(sentToken, pool)]);
assert.equal(parallelVerifications.filter(result => result.ok === true).length, 1, "a verification token must be accepted only once concurrently");
assert.equal(parallelVerifications.filter(result => result.error === "VERIFICATION_TOKEN_INVALID_OR_EXPIRED").length, 1, "the concurrent token replay must be rejected");
assert.ok(pool.account.email_verified_at, "successful verification must update the account");
console.log("Email verification concurrency: one resend and one token consumption under parallel requests passed.");
