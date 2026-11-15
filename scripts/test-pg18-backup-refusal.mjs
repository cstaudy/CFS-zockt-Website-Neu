import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

// No database or real Docker daemon is contacted. A fake docker executable
// records whether an unsafe call got past the CI-only guard.
const target = fileURLToPath(new URL("./test-pg18-backup-restore.sh", import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), "cfs-pg18-refusal-"));
const dockerLog = join(scratch, "docker.log");
const fakeDocker = join(scratch, "docker");
const dockerStub = [
  "#!/bin/sh",
  'printf "%s\\n" "$*" >> "$CFS_TEST_DOCKER_LOG"',
  'case "$1" in',
  '  ps) printf "%s\\n" fake-ci-container ;;',
  '  inspect) printf "%s\\n" "POSTGRES_DB=not_ci" "POSTGRES_USER=cfs_ci" ;;',
  '  *) exit 99 ;;',
  "esac",
  ""
].join("\n");

try {
  await writeFile(fakeDocker, dockerStub, { mode: 0o700 });
  const base = {
    ...process.env,
    PATH: scratch + delimiter + (process.env.PATH ?? ""),
    CFS_TEST_DOCKER_LOG: dockerLog,
    DATABASE_URL: "postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/cfs_ci",
    CFS_CI_DATABASE_ACCEPTANCE: "yes",
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "cstaudy/CFS-zockt-Website-Neu",
    GITHUB_JOB: "check"
  };
  const run = overrides => spawnSync("bash", [target], {
    env: { ...base, ...overrides },
    encoding: "utf8",
    timeout: 8000
  });

  for (const [description, overrides] of [
    ["missing disposable database opt-in", { CFS_CI_DATABASE_ACCEPTANCE: "" }],
    ["other database", { DATABASE_URL: "postgresql://ci@127.0.0.1:5432/not_cfs_ci" }],
    ["not running in GitHub Actions", { GITHUB_ACTIONS: "false" }],
    ["wrong repository", { GITHUB_REPOSITORY: "someone-else/website" }],
    ["wrong job", { GITHUB_JOB: "untrusted-job" }]
  ]) {
    await writeFile(dockerLog, "");
    const result = run(overrides);
    assert.equal(result.status, 2, description + ": must refuse before Docker");
    assert.match(result.stderr, /REFUSED:/, description);
    assert.equal(await readFile(dockerLog, "utf8"), "",
      description + ": Docker must never be invoked");
  }

  // Simulate all CI env vars being correct but the discovered PostgreSQL 18
  // container belonging to an unrelated service. The guard must refuse
  // BEFORE any docker exec, pg_dump, createdb, dropdb or DROP ROLE call.
  await writeFile(dockerLog, "");
  const foreignContainer = run({});
  assert.equal(foreignContainer.status, 2, "Foreign Docker service must be rejected");
  assert.match(foreignContainer.stderr, /REFUSED: selected postgres:18 container/);
  const calls = (await readFile(dockerLog, "utf8")).trim().split("\n");
  assert.equal(calls.length, 2, "Only docker ps and docker inspect are allowed");
  assert.match(calls[0], /^ps /);
  assert.match(calls[1], /^inspect /);
  assert(!calls.some(call => /^(?:exec|run|rm|stop)\s/.test(call)),
    "No potentially destructive Docker call may run for a foreign service");

  console.log("PG18 backup refusal: five invalid CI contexts and foreign Docker service safely blocked.");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
