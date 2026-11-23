import assert from 'node:assert/strict';
import { applyMigrations, baselineMigrations } from '../src/migration-runner.js';
import { migrationFiles, loadMigrationSql } from '../src/migrations.js';

function fakeClient({ legacyTables = false, historyExists = false, recorded = [] } = {}) {
  const rows = new Map(recorded);
  const executed = [];
  let pending;
  let historyInitialized = historyExists || recorded.length > 0;
  return {
    rows, executed,
    async query(sql, params = []) {
      executed.push(sql.trim().toLowerCase().split(/\s+/).slice(0, 3).join(' '));
      if (sql.includes("to_regclass('public.schema_migrations')")) return { rows: [{ history_exists: historyInitialized, application_tables_exist: legacyTables || rows.size > 0 }] };
      if (sql === 'select exists (select 1 from schema_migrations) as has_entries') return { rows: [{ has_entries: rows.size > 0 }] };
      if (sql === 'select name, checksum from schema_migrations order by name') {
        return { rows: [...rows].sort(([a], [b]) => a.localeCompare(b))
          .map(([name, checksum]) => ({ name, checksum })) };
      }
      if (sql.startsWith('create table if not exists schema_migrations')) { historyInitialized = true; return {}; }
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
const legacy = fakeClient({ legacyTables: true });
await assert.rejects(applyMigrations(legacy, files, file => sql[file]), /Bestehende Datenbank ohne Migrationshistorie/);
assert(!legacy.executed.some(item => item.startsWith('create table')), 'legacy schema must not be modified');
assert.equal(legacy.executed.at(-1), 'select pg_advisory_unlock($1)', 'lock released on legacy schema guard');

const emptyHistory = fakeClient({ legacyTables: true, historyExists: true });
await assert.rejects(applyMigrations(emptyHistory, files, file => sql[file]), /leerer Migrationshistorie/);
assert(!emptyHistory.executed.some(item => item.startsWith('create table')), 'empty history must not be modified');

// Previously the runner only checked expected migration names one by one.
// An unknown recorded migration or a hole could survive until later writes.
const checkpoint = fakeClient({ recorded: [['002.sql', 'untrusted-checksum']] });
await assert.rejects(applyMigrations(checkpoint, files, file => sql[file]),
  /nicht lückenlos|unbekannte Migrationen/);
assert(!checkpoint.executed.includes('begin'), 'Out-of-order history must not begin a migration transaction');
assert.equal(checkpoint.executed.at(-1), 'select pg_advisory_unlock($1)',
  'Ledger prefix error must always release advisory lock');

const unknown = fakeClient({ recorded: [['999_unknown.sql', 'unexpected-checksum']] });
await assert.rejects(applyMigrations(unknown, files, file => sql[file]),
  /nicht lückenlos|unbekannte Migrationen/);
assert(!unknown.executed.includes('begin'), 'Unknown ledger entry must block any pending migration');

const extra = fakeClient({ recorded: [
  ['001.sql', 'ignored-for-prefix-test'], ['002.sql', 'ignored-for-prefix-test'],
  ['003_future.sql', 'untrusted-checksum']
] });
await assert.rejects(applyMigrations(extra, files, file => sql[file]),
  /unvollständig, unbekannt oder ungültig/);
assert(!extra.executed.includes('begin'));

const tampered = fakeClient({ recorded: [['001.sql', 'wrong-checksum']] });
await assert.rejects(applyMigrations(tampered, files, file => sql[file]),
  /Migration wurde nach Ausführung geändert: 001.sql/);
assert(!tampered.executed.includes('begin'),
  'Wrong stored checksum must be caught before later migration DDL');

await assert.rejects(applyMigrations(fakeClient(), ['001.sql', '001.sql'],
  () => 'create table repeated'), /unvollständig, unbekannt oder ungültig/);
console.log('Migration runner: apply, complete prefix/checksums, unknown entries, missing ledger, rollback passed.');

function baselineClient(existing = []) {
  const executed = [];
  const inserted = [];
  return {
    executed, inserted,
    async query(sql, params = []) {
      executed.push(sql);
      if (sql.startsWith('select name, checksum')) return { rows: existing };
      if (sql.startsWith('insert into schema_migrations')) inserted.push(params);
      return { rows: [] };
    }
  };
}

const baseline = baselineClient();
await baselineMigrations(baseline, files, file => sql[file], async () => 'unchanged');
assert.equal(baseline.inserted.length, 2, 'baseline should record every unchanged migration');
assert.equal(baseline.executed.filter(item => item === 'rollback').length, 1, 'baseline probe must roll back');
const repeated = baselineClient(baseline.inserted.map(([name, checksum]) => ({ name, checksum })));
await baselineMigrations(repeated, files, file => sql[file], async () => 'unchanged');
assert.equal(repeated.inserted.length, 0, 'matching baseline should be safely repeatable');
await assert.rejects(
  baselineMigrations(baselineClient([{ name: '001.sql', checksum: 'wrong' }]), files, file => sql[file], async () => 'unchanged'),
  /Migrationshistorie stimmt nicht/
);
const changed = baselineClient();
let fingerprintCall = 0;
await assert.rejects(
  baselineMigrations(changed, files, file => sql[file], async () => ++fingerprintCall === 1 ? 'before' : 'after'),
  /würde das vorhandene Schema verändern/
);
assert.equal(changed.inserted.length, 0, 'changed schema must never be baselined');
await assert.rejects(
  baselineMigrations(baselineClient(), ['unsafe.sql'], () => 'delete from accounts', async () => 'same'),
  /datenverändernde Migration/
);
const productionBaseline = baselineClient();
await baselineMigrations(productionBaseline, migrationFiles, loadMigrationSql, async () => 'unchanged');
assert.equal(productionBaseline.inserted.length, 26, 'all production migrations must be baseline-safe');
console.log('Migration baseline: unchanged-schema guard, rollback and unsafe-SQL guard passed.');
