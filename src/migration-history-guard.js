// Prevent regular migrations from silently treating an existing legacy database
// as a fresh installation. This guard only reads PostgreSQL catalog metadata.
export async function assertMigrationHistorySafe(client) {
  const result = await client.query(`
    select
      to_regclass('public.schema_migrations') is not null as history_exists,
      exists (
        select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and c.relname <> 'schema_migrations'
      ) as application_tables_exist
  `);
  const state = result.rows?.[0];
  if (typeof state?.history_exists !== 'boolean' || typeof state?.application_tables_exist !== 'boolean') {
    throw new Error('Migrationsstatus der Datenbank konnte nicht geprüft werden.');
  }
  if (!state.application_tables_exist) return;
  if (!state.history_exists) {
    throw new Error('Bestehende Datenbank ohne Migrationshistorie: erst Backup prüfen und kontrollierte Migration-Baseline ausführen.');
  }
  const entries = await client.query('select exists (select 1 from schema_migrations) as has_entries');
  if (entries.rows?.[0]?.has_entries !== true) {
    throw new Error('Bestehende Datenbank mit leerer Migrationshistorie: automatischer Migrationslauf verweigert.');
  }
}
