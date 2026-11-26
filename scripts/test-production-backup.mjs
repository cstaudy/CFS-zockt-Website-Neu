import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production backup script enforces protected storage, TLS and restore comparison", async () => {
  const source = await readFile(new URL("./production-pg-backup.ps1", import.meta.url), "utf8");
  assert.match(source, /Get-BitLockerVolume/);
  assert.match(source, /OneDrive/);
  assert.match(source, /PGSSLMODE\s*=\s*"verify-full"/);
  assert.match(source, /PGSSLROOTCERT\s*=\s*\$script:RootCertificate/);
  assert.match(source, /function Assert-RootCertificate/);
  assert.match(source, /96BCEC06264976F37460779ACF28C5A7CFE8A3C0AAE11A8FFCEE05C0BDDF08C6/);
  assert.match(source, /69729B8E15A86EFC177A57AFB7171DFC64ADD28C2FCA8CF1507E34453CCB1470/);
  assert.match(source, /PSNativeCommandUseErrorActionPreference/);
  assert.match(source, /function Assert-NetworkReachability/);
  assert.match(source, /function Write-Diagnostic/);
  assert.match(source, /function ConvertTo-SafeDiagnostic/);
  assert.match(source, /PGSERVICEFILE/);
  assert.match(source, /\[string\]\$HostName/);
  assert.match(source, /Read-DatabaseCredentials "Render-Quelle" \$Database \$HostName \$Port \$User/);
  assert.match(source, /\[string\]\$RootCertificatePath/);
  assert.match(source, /certutil\.exe -dump/);
  assert.match(source, /function Assert-Manifest/);
  assert.match(source, /Assert-Manifest \$dumpPath/);
  assert.match(source, /--single-transaction/);
  assert.match(source, /function Compare-RestoredDatabase/);
  assert.match(source, /function Get-TableFingerprint/);
  assert.match(source, /digest\([^\n]+sha256/);
});
