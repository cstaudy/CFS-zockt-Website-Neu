import assert from 'node:assert/strict';
import { savePendingMfaSetup } from '../src/mfa-setup-guard.js';

const queries = [];
const pool = {
  async query(sql, params) {
    queries.push({ sql, params });
    return { rowCount: 1 };
  }
};
assert.equal(await savePendingMfaSetup(pool, 'account-1', 'new-secret'), true);
assert.equal(queries.length, 1);
assert.deepEqual(queries[0].params, ['account-1', 'new-secret']);
assert.match(queries[0].sql, /on conflict\s*\(account_id\)\s*do update/i);
assert.match(queries[0].sql, /where account_mfa\.enabled = false/i);
assert.match(queries[0].sql, /returning account_id/i);

const enabledAccountPool = { query: async () => ({ rowCount: 0 }) };
assert.equal(await savePendingMfaSetup(enabledAccountPool, 'account-enabled', 'new-secret'), false,
  'already enabled MFA must not be replaced by a new setup');
const emptyResultPool = { query: async () => ({ rowCount: 2 }) };
assert.equal(await savePendingMfaSetup(emptyResultPool, 'account-1', 'secret'), false, 'unexpected rowcount must fail closed');

console.log('MFA setup guard: existing enabled MFA cannot be overwritten by setup.');
