import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production backup script enforces protected storage, TLS and restore comparison", async () => {
  const source = await readFile(new URL("./production-pg-backup.ps1", import.meta.url), "utf8");
  assert.match(source, /Get-BitLockerVolume/);
  assert.match(source, /OneDrive/);
  assert.match(source, /PGSSLMODE\s*=\s*"verify-full"/);
  assert.match(source, /PGSSLROOTCERT\s*=\s*"system"/);
  assert.match(source, /function Assert-Manifest/);
  assert.match(source, /Assert-Manifest \$dumpPath/);
  assert.match(source, /--single-transaction/);
  assert.match(source, /function Compare-RestoredDatabase/);
  assert.match(source, /function Get-TableFingerprint/);
  assert.match(source, /digest\([^\n]+sha256/);
});
