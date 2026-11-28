import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/tool-jobs.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/027_launcher_job_claims.sql", import.meta.url), "utf8");
assert.match(source, /claimed_by_device=\$2/);
assert.match(source, /claimed_by_device=\$6/);
assert.match(source, /claimed_by_device,created_at/);
assert.match(migration, /add column if not exists claimed_by_device uuid references launcher_devices/);
assert.match(migration, /tool_jobs_claimed_device_idx/);
console.log("Launcher claim contract: migration 027 and exact claiming-device predicates passed.");
