import assert from 'node:assert/strict';
import { applyMigrations } from '../src/migration-runner.js';

function fakeClient() {
  const rows = new Map();
  const executed = [];
  let pending;
  return {
    rows, executed,
    async query(sql, params = []) {
      executed.push(sql.trim().toLowerCase().split(/\s+/).slice(0, 3).join(' '));
      if (sql.startsWith('select checksum')) return { rows: rows.has(params[0]) ? [{ checksum: rows.get(params[0]) }] : [] };
      if (sql === 'begin') { pending = null; return {}; }
      if (sql.startsWith('insert into schema_migrations')) { pending = params; return {}; }
      if (sql === 'commit') { if (pending) rows.set(pending[0], pending[1]); pending = null; return {}; }
      if (sql === 'rollback') { pending = null; return {}; }
      if (sql === 'fail sql') throw new Error('SQL failed');
      return {};
    }
  };
}

const client = fakeClient();
const files = ['001.sql', '002.sql'];
const sql = { '001.sql': 'create table one', '002.sql': 'create table two' };
await applyMigrations(client, files, file => sql[file]);
assert.equal(client.rows.size, 2);
const commits = client.executed.filter(item => item === 'commit').length;
await applyMigrations(client, files, file => sql[file]);
assert.equal(client.executed.filter(item => item === 'commit').length, commits, 'second start must skip completed migrations');
await assert.rejects(applyMigrations(client, files, file => file === '001.sql' ? 'changed sql' : sql[file]), /geändert/);
assert.equal(client.executed.at(-1), 'select pg_advisory_unlock($1)', 'lock released on checksum error');
const failed = fakeClient();
await assert.rejects(applyMigrations(failed, ['003.sql'], () => 'fail sql'), /SQL failed/);
assert(failed.executed.includes('rollback'), 'failed SQL must roll back');
assert.equal(failed.rows.size, 0);
console.log('Migration runner: apply, skip, checksum guard and rollback passed.');
