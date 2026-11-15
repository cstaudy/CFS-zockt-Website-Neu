#!/usr/bin/env bash
# Backup/restore acceptance test ONLY for the disposable PostgreSQL 18 CI service.
# Never run this script against Render, staging, production, or an arbitrary DB.
set -euo pipefail
umask 077

if [[ "${CFS_CI_DATABASE_ACCEPTANCE:-}" != "yes" ||
      "${DATABASE_URL:-}" != "postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/cfs_ci" ]]; then
  echo "REFUSED: backup/restore acceptance requires the exact disposable CI database." >&2
  exit 2
fi

mapfile -t containers < <(docker ps --filter ancestor=postgres:18 --format '{{.ID}}')
if [[ "${#containers[@]}" -ne 1 ]]; then
  echo "REFUSED: expected exactly one disposable postgres:18 service container." >&2
  exit 2
fi
container="${containers[0]}"
archive_dir="$(mktemp -d)"
archive="${archive_dir}/cfs-ci.pgdump"
restore_db="cfs_ci_restore_acceptance"
# All ACL/owner fixtures are created ONLY inside the guarded ephemeral PG18 CI
# container. Unique names avoid overwriting any other temporary test database.
probe_nonce="$(printf '%04x%04x' "$RANDOM" "$RANDOM")"
probe_source_db="cfs_ci_acl_source_${probe_nonce}"
probe_clone_db="cfs_ci_acl_clone_${probe_nonce}"
probe_owner_role="cfs_ci_acl_owner_${probe_nonce}"
probe_reader_role="cfs_ci_acl_reader_${probe_nonce}"
probe_archive="${archive_dir}/acl-probe.pgdump"
cleanup() {
  docker exec "$container" dropdb -U cfs_ci --if-exists "$probe_clone_db" >/dev/null 2>&1 || true
  docker exec "$container" dropdb -U cfs_ci --if-exists "$probe_source_db" >/dev/null 2>&1 || true
  docker exec "$container" psql -U cfs_ci -d cfs_ci -qAt -v ON_ERROR_STOP=1 \
    -c "DROP ROLE IF EXISTS ${probe_owner_role}; DROP ROLE IF EXISTS ${probe_reader_role};" >/dev/null 2>&1 || true
  docker exec "$container" dropdb -U cfs_ci --if-exists "$restore_db" >/dev/null 2>&1 || true
  rm -rf -- "$archive_dir"
}
trap cleanup EXIT

docker exec "$container" pg_dump --version | grep -Eq 'PostgreSQL.*18[.]'
# Dump remains only on the ephemeral CI runner, never in GitHub artifacts/logs.
docker exec "$container" pg_dump -U cfs_ci -d cfs_ci -Fc --no-owner --no-acl > "$archive"
test -s "$archive"
sha256sum "$archive" > "${archive}.sha256"
(cd "$archive_dir" && sha256sum --check --status cfs-ci.pgdump.sha256)
docker exec -i "$container" pg_restore --list < "$archive" > /dev/null

# Restore must be performed into a separate, initially empty database.
docker exec "$container" dropdb -U cfs_ci --if-exists "$restore_db" > /dev/null
docker exec "$container" createdb -U cfs_ci "$restore_db"
docker exec -i "$container" pg_restore -U cfs_ci -d "$restore_db" \
  --no-owner --no-acl --exit-on-error < "$archive"

sql="select count(*) from public.schema_migrations"
source_migrations="$(docker exec "$container" psql -U cfs_ci -d cfs_ci -At -v ON_ERROR_STOP=1 -c "$sql")"
restored_migrations="$(docker exec "$container" psql -U cfs_ci -d "$restore_db" -At -v ON_ERROR_STOP=1 -c "$sql")"
[[ "$source_migrations" == "25" && "$restored_migrations" == "25" ]] || {
  echo "Migrations ledger did not survive restore." >&2
  exit 1
}

# Compare exact SQL-derived row signatures across sensitive application tables,
# without printing any passwords, session hashes, account data or dump contents.
for table in accounts sessions creator_projects creator_assets user_media \
             account_mfa account_security_events mfa_login_challenges \
             creator_settings schema_migrations; do
  sql="select md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' order by row_to_json(t)::text), '')) from (select * from public.${table}) t"
  source_fingerprint="$(docker exec "$container" psql -U cfs_ci -d cfs_ci -At -v ON_ERROR_STOP=1 -c "$sql")"
  restored_fingerprint="$(docker exec "$container" psql -U cfs_ci -d "$restore_db" -At -v ON_ERROR_STOP=1 -c "$sql")"
  [[ "$source_fingerprint" == "$restored_fingerprint" ]] || {
    echo "Restored table verification failed: ${table}" >&2
    exit 1
  }
done

# Check catalog-level table/column structure after full restore.
catalog_sql="select md5(string_agg(table_name || ':' || column_name || ':' || data_type, ',' order by table_name, ordinal_position)) from information_schema.columns where table_schema='public'"
source_catalog="$(docker exec "$container" psql -U cfs_ci -d cfs_ci -At -v ON_ERROR_STOP=1 -c "$catalog_sql")"
restore_catalog="$(docker exec "$container" psql -U cfs_ci -d "$restore_db" -At -v ON_ERROR_STOP=1 -c "$catalog_sql")"
[[ "$source_catalog" == "$restore_catalog" ]] || {
  echo "Restored database schema does not match source." >&2
  exit 1
}

# Regression: a successful --no-owner/--no-acl restore does NOT prove that
# original SQL roles, table owners or grants will work after migration. Construct
# a separate synthetic database and prove data survives while privilege metadata
# deliberately changes. No accounts or application DB tables are touched.
docker exec "$container" psql -U cfs_ci -d cfs_ci -qAt -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE ${probe_owner_role} NOLOGIN; CREATE ROLE ${probe_reader_role} NOLOGIN;" > /dev/null
docker exec "$container" createdb -U cfs_ci "$probe_source_db"
docker exec "$container" createdb -U cfs_ci "$probe_clone_db"
docker exec "$container" psql -U cfs_ci -d "$probe_source_db" -qAt -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE public.acl_probe (id integer PRIMARY KEY, label text NOT NULL);
      INSERT INTO public.acl_probe VALUES (1, 'synthetic-fixture');
      ALTER TABLE public.acl_probe OWNER TO ${probe_owner_role};
      GRANT SELECT ON public.acl_probe TO ${probe_reader_role};" > /dev/null

owner_sql="SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.acl_probe'::regclass"
reader_sql="SELECT has_table_privilege('${probe_reader_role}', 'public.acl_probe', 'SELECT')"
source_owner="$(docker exec "$container" psql -U cfs_ci -d "$probe_source_db" -At -v ON_ERROR_STOP=1 -c "$owner_sql")"
source_reader="$(docker exec "$container" psql -U cfs_ci -d "$probe_source_db" -At -v ON_ERROR_STOP=1 -c "$reader_sql")"
[[ "$source_owner" == "$probe_owner_role" && "$source_reader" == "t" ]] || {
  echo "Synthetic ACL fixture does not contain the expected source ownership and grant." >&2
  exit 1
}

docker exec "$container" pg_dump -U cfs_ci -d "$probe_source_db" -Fc \
  --no-owner --no-acl > "$probe_archive"
test -s "$probe_archive"
docker exec -i "$container" pg_restore -U cfs_ci -d "$probe_clone_db" \
  --no-owner --no-acl --exit-on-error < "$probe_archive"
restored_owner="$(docker exec "$container" psql -U cfs_ci -d "$probe_clone_db" -At -v ON_ERROR_STOP=1 -c "$owner_sql")"
restored_reader="$(docker exec "$container" psql -U cfs_ci -d "$probe_clone_db" -At -v ON_ERROR_STOP=1 -c "$reader_sql")"
restored_count="$(docker exec "$container" psql -U cfs_ci -d "$probe_clone_db" -At -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) FROM public.acl_probe')"
[[ "$restored_owner" == "cfs_ci" && "$restored_reader" == "f" && "$restored_count" == "1" ]] || {
  echo "Synthetic restore ACL test failed: restored data should survive but owner/grant must not." >&2
  exit 1
}
echo "PostgreSQL 18 CI ACL rehearsal: synthetic row restored, original owner and reader grant intentionally absent; real migrations still require operator role checks."

echo "PostgreSQL 18 CI backup verified: pg_dump archive, SHA-256, clean pg_restore, 25 migrations, application rows and schema."
echo "Only disposable CI data was used; temporary archive and restore DB will be deleted."
