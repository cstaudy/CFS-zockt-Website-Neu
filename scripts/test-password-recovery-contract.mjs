import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requestPasswordReset } from "../src/auth.js";

const source = await readFile(new URL("../src/auth.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/026_password_recovery_rate_limit.sql", import.meta.url), "utf8");
assert.match(source, /password_recovery_attempts/);
assert.match(source, /pg_advisory_xact_lock/);
assert.match(source, /accountLockKey/);
assert.match(source, /lockAccountMutation/);
assert.match(source, /changePassword[\s\S]*BEGIN/);
assert.match(source, /await client\.query\("ROLLBACK"\)/);
assert.match(serverSource, /MAIL_.*Die Antwort bleibt für alle Adressen gleich/s);
assert.match(migration, /ip_hash text not null/);
assert.match(migration, /on password_recovery_attempts\(account_id, created_at desc\)/);
assert.match(migration, /on password_recovery_attempts\(ip_hash, created_at desc\)/);

class RecoveryPool {
  constructor() {
    this.accounts = new Map([["owner@example.invalid", { id: "account-1", email: "owner@example.invalid" }]]);
    this.attempts = [];
    this.tokens = [];
    this.owner = null;
    this.waiters = [];
  }

  async connect() { return new RecoveryClient(this); }

  async acquire(client) {
    if (this.owner === client) return;
    if (this.owner) await new Promise(resolve => this.waiters.push(resolve));
    this.owner = client;
  }

  release(client) {
    if (this.owner !== client) return;
    this.owner = null;
    this.waiters.shift()?.();
  }
}

class RecoveryClient {
  constructor(pool) {
    this.pool = pool;
    this.attemptsAdded = [];
    this.tokensAdded = [];
  }

  async query(sql, params = []) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized === "begin") return { rows: [] };
    if (normalized.startsWith("select pg_advisory_xact_lock")) {
      await this.pool.acquire(this);
      return { rows: [] };
    }
    if (normalized.startsWith("select id from accounts")) {
      const account = this.pool.accounts.get(params[0]);
      return { rows: account ? [{ id: account.id }] : [] };
    }
    if (normalized.startsWith("select id,email from accounts")) {
      const account = this.pool.accounts.get(params[0]);
      return { rows: account ? [account] : [] };
    }
    if (normalized.startsWith("select (select count(*)::int from password_recovery_attempts")) {
      const accountId = params[0];
      const ipHash = params[1];
      return {
        rows: [{
          account_count: this.pool.attempts.filter(item => item.accountId === accountId).length,
          ip_count: this.pool.attempts.filter(item => item.ipHash === ipHash).length
        }]
      };
    }
    if (normalized.startsWith("insert into password_recovery_attempts")) {
      const item = { accountId: params[0], ipHash: params[1] };
      this.pool.attempts.push(item);
      this.attemptsAdded.push(item);
      return { rows: [] };
    }
    if (normalized.startsWith("delete from password_recovery_tokens")) {
      this.pool.tokens = this.pool.tokens.filter(item => item.accountId !== params[0]);
      return { rows: [] };
    }
    if (normalized.startsWith("insert into password_recovery_tokens")) {
      const item = { accountId: params[0], tokenHash: params[1] };
      this.pool.tokens.push(item);
      this.tokensAdded.push(item);
      return { rows: [] };
    }
    if (normalized === "commit") {
      this.pool.release(this);
      return { rows: [] };
    }
    if (normalized === "rollback") {
      this.pool.attempts = this.pool.attempts.filter(item => !this.attemptsAdded.includes(item));
      this.pool.tokens = this.pool.tokens.filter(item => !this.tokensAdded.includes(item));
      this.pool.release(this);
      return { rows: [] };
    }
    throw new Error(`Unhandled fake SQL: ${sql}`);
  }

  release() {}
}

const savedFetch = globalThis.fetch;
const savedEnv = { ...process.env };
try {
  process.env.RESEND_API_KEY = "test-key";
  process.env.MAIL_FROM = "test@example.invalid";
  process.env.APP_BASE_URL = "https://cfs-zockt-staging.onrender.com";
  process.env.SESSION_SECRET = "test-session-secret";
  let deliveryOk = true;
  let deliveries = 0;
  globalThis.fetch = async () => {
    deliveries += 1;
    await new Promise(resolve => setTimeout(resolve, 2));
    return { ok: deliveryOk, status: deliveryOk ? 200 : 422 };
  };

  const pool = new RecoveryPool();
  const generic = { message: "Wenn ein passendes Konto existiert, kann eine E-Mail folgen. Die Antwort bleibt für alle Adressen gleich." };
  assert.deepEqual(await requestPasswordReset("owner@example.invalid", "198.51.100.10", pool), generic);
  assert.deepEqual(await requestPasswordReset("missing@example.invalid", "198.51.100.11", pool), generic);
  assert.equal(pool.tokens.length, 1, "unknown accounts must not create recovery tokens");

  const beforeRateLimit = deliveries;
  const parallel = await Promise.all(Array.from({ length: 5 }, () =>
    requestPasswordReset("owner@example.invalid", "198.51.100.10", pool)));
  assert(parallel.every(result => result.message === generic.message), "rate-limited requests keep the neutral response");
  assert.equal(deliveries - beforeRateLimit, 4, "account limit must cap deliveries at five per window");
  assert.equal(pool.attempts.filter(item => item.accountId === "account-1").length, 5);

  const failedPool = new RecoveryPool();
  deliveryOk = false;
  const failed = await requestPasswordReset("owner@example.invalid", "198.51.100.12", failedPool);
  assert.deepEqual(failed, { error: "MAIL_DELIVERY_FAILED", status: 502 });
  assert.equal(failedPool.attempts.length, 0, "failed mail must roll back the rate-limit attempt");
  assert.equal(failedPool.tokens.length, 0, "failed mail must not leave a usable token");
  console.log("Password recovery contract: neutral response, ordered concurrent locks, account/IP rate limits and delivery rollback passed.");
} finally {
  globalThis.fetch = savedFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
}
