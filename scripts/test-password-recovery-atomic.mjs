import assert from "node:assert/strict";
import { resetPassword } from "../src/auth.js";

class RecoveryPool {
  constructor({ expiresAt = Date.now() + 1_800_000 } = {}) {
    this.tokenUsed = false;
    this.tokenExpiresAt = expiresAt;
    this.accountUpdates = 0;
    this.locked = false;
    this.waiters = [];
  }

  async connect() {
    return new RecoveryClient(this);
  }

  async claimToken(client) {
    if (this.locked) await new Promise(resolve => this.waiters.push(resolve));
    this.locked = true;
    if (this.tokenUsed || this.tokenExpiresAt <= Date.now()) {
      this.locked = false;
      this.waiters.shift()?.();
      return null;
    }
    client.claimed = true;
    this.tokenUsed = true;
    return { account_id: "account-1" };
  }

  finish(client, rollback) {
    if (rollback && client.claimed) this.tokenUsed = false;
    if (client.claimed) {
      client.claimed = false;
      this.locked = false;
      this.waiters.shift()?.();
    }
  }
}

class RecoveryClient {
  constructor(pool) {
    this.pool = pool;
    this.claimed = false;
  }

  async query(sql) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized === "begin") return { rows: [] };
    if (normalized.startsWith("update password_recovery_tokens set used_at")) {
      const row = await this.pool.claimToken(this);
      return { rows: row ? [row] : [] };
    }
    if (normalized.startsWith("update accounts set password_hash")) {
      this.pool.accountUpdates += 1;
      return { rows: [] };
    }
    if (normalized.startsWith("delete from sessions") || normalized.startsWith("delete from mfa_login_challenges")) {
      return { rows: [] };
    }
    if (normalized === "commit") {
      this.pool.finish(this, false);
      return { rows: [] };
    }
    if (normalized === "rollback") {
      this.pool.finish(this, true);
      return { rows: [] };
    }
    throw new Error(`Unhandled fake SQL: ${sql}`);
  }

  release() {}
}

const pool = new RecoveryPool();
const results = await Promise.all([
  resetPassword("same-token", "a-very-long-test-password-1", pool),
  resetPassword("same-token", "a-very-long-test-password-2", pool)
]);
assert.equal(results.filter(result => result.ok === true).length, 1);
assert.equal(results.filter(result => result.error === "RECOVERY_TOKEN_INVALID_OR_EXPIRED").length, 1);
assert.equal(pool.accountUpdates, 1, "a recovery token may update the account only once");

const expired = new RecoveryPool({ expiresAt: Date.now() - 1 });
const expiredResult = await resetPassword("expired-token", "a-very-long-test-password-3", expired);
assert.deepEqual(expiredResult, { error: "RECOVERY_TOKEN_INVALID_OR_EXPIRED", status: 400 });
assert.equal(expired.accountUpdates, 0);

console.log("Password recovery atomicity: concurrent, expired and one-time token paths passed.");
