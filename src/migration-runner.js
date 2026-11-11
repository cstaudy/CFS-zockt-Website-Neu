import { createHash } from 'node:crypto';

const lockId = 62917431;

export async function applyMigrations(client, files, loadSql) {
  await client.query('select pg_advisory_lock($1)', [lockId]);
  try {
    await client.query(`create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`);
    for (const file of files) {
      const sql = await loadSql(file);
      const checksum = createHash('sha256').update(sql).digest('hex');
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
