import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("./test-pg18-backup-restore.sh", import.meta.url));
const source = await readFile(target, "utf8");

assert.match(source, /^#!\/usr\/bin\/env bash/);
for (const contract of [
  /set -euo pipefail/,
  /umask 077/,
  /CFS_CI_DATABASE_ACCEPTANCE:-.*yes/,
  /DATABASE_URL:-.*ci_test_only_password.*127\.0\.0\.1:5432\/cfs_ci/,
  /GITHUB_ACTIONS:-.*true/,
  /GITHUB_REPOSITORY:-.*cstaudy\/CFS-zockt-Website-Neu/,
  /GITHUB_JOB:-.*check/,
  /docker ps --filter ancestor=postgres:18/,
  /pg_dump --version/,
  /pg_dump .*--format|pg_dump .* -Fc/,
  /pg_restore/,
  /sha256sum/,
  /trap cleanup EXIT/,
  /--no-owner --no-acl/,
  /expected_migrations=.*migrationFiles\.length/,
  /source_migrations.*expected_migrations.*restored_migrations/,
  /password_recovery_attempts launcher_devices tool_jobs schema_migrations/,
  /\$\{expected_migrations\} migrations/
]) assert.match(source, contract);

assert.doesNotMatch(source, /source_migrations.*==\s*["']25["']/,
  "Backup acceptance must not hard-code an obsolete migration count");

const syntax = spawnSync("bash", ["-n", target], { encoding: "utf8" });
if (syntax.error?.code === "ENOENT") {
  console.log("PG18 backup contract: static guard passed; Bash syntax deferred because bash is unavailable on this Windows host.");
} else {
  assert.equal(syntax.status, 0, syntax.stderr || "Bash syntax check failed");
  console.log("PG18 backup contract: static guard and Bash syntax passed.");
}
