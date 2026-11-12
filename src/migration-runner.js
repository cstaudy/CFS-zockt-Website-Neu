import { createHash } from 'node:crypto';
import { assertMigrationHistorySafe } from './migration-history-guard.js';

const lockId = 62917431;

function migrationChecksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

async function schemaFingerprint(client) {
  const queries = [
    `select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
       from information_schema.columns
      where table_schema='public' and table_name <> 'schema_migrations'
      order by table_name, ordinal_position`,
    `select tablename, indexname, indexdef from pg_indexes
      where schemaname='public' and tablename <> 'schema_migrations'
      order by tablename, indexname`,
    `select table_name, constraint_name, constraint_type
       from information_schema.table_constraints
      where table_schema='public' and table_name <> 'schema_migrations'
      order by table_name, constraint_name`,
    `select extname, extversion from pg_extension order by extname`
  ];
  const snapshots = [];
  for (const sql of queries) snapshots.push((await client.query(sql)).rows);
  return JSON.stringify(snapshots);
}

function assertBaselineSafe(sql, file) {
  if (/(?:^|;)\s*(insert|update|delete|merge|truncate|drop)\b/i.test(sql)) {
    throw new Error(`Baseline verweigert eine potenziell datenverändernde Migration: ${file}`);
  }
}

export async function applyMigrations(client, files, loadSql) {
  await client.query('select pg_advisory_lock($1)', [lockId]);
  try {
    await assertMigrationHistorySafe(client);
    await client.query(`create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`);
    for (const file of files) {
      const sql = await loadSql(file);
      const checksum = migrationChecksum(sql);
      const previous = await client.query('select checksum from schema_migrations where name=$1', [file]);
      if (previous.rows.length) {
        if (previous.rows[0].checksum !== checksum) throw new Error(`Migration wurde nach Ausführung geändert: ${file}`);
        console.log(`migration skip: ${file}`);
        continue;
      }
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations(name, checksum) values($1, $2)', [file, checksum]);
        await client.query('commit');
        console.log(`migration ok: ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [lockId]);
  }
}

export async function baselineMigrations(client, files, loadSql, fingerprint = schemaFingerprint) {
  await client.query('select pg_advisory_lock($1)', [lockId]);
  let transactionOpen = false;
  try {
    const migrations = [];
    for (const file of files) {
      const sql = await loadSql(file);
      assertBaselineSafe(sql, file);
      migrations.push({ file, sql, checksum: migrationChecksum(sql) });
    }
    const before = await fingerprint(client);
    await client.query('begin');
    transactionOpen = true;
    for (const migration of migrations) await client.query(migration.sql);
    const after = await fingerprint(client);
    await client.query('rollback');
    transactionOpen = false;
    if (before !== after) throw new Error('Baseline abgebrochen: Mindestens eine Migration würde das vorhandene Schema verändern.');

    await client.query('begin');
    transactionOpen = true;
    await client.query(`create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`);
    const existing = await client.query('select name, checksum from schema_migrations order by name');
    if (existing.rows.length) {
      const expected = new Map(migrations.map(migration => [migration.file, migration.checksum]));
      const valid = existing.rows.length === migrations.length
        && existing.rows.every(row => expected.get(row.name) === row.checksum);
      if (!valid) throw new Error('Baseline abgebrochen: Die vorhandene Migrationshistorie stimmt nicht mit den Dateien überein.');
      await client.query('commit');
      transactionOpen = false;
      console.log(`migration baseline skip: ${migrations.length} migrations already registered`);
      return;
    }
    for (const migration of migrations) {
      await client.query('insert into schema_migrations(name, checksum) values($1, $2)', [migration.file, migration.checksum]);
    }
    await client.query('commit');
    transactionOpen = false;
    console.log(`migration baseline ok: ${migrations.length} migrations`);
  } catch (error) {
    if (transactionOpen) await client.query('rollback');
    throw error;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [lockId]);
  }
}
