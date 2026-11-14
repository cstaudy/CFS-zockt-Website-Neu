import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../docs/operations/", import.meta.url);
const read = name => readFile(new URL(name, root), "utf8");

const [template, gates, deadline] = await Promise.all([
  read("DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md"),
  read("PRODUCTION_BACKUP_STAGING_GATE.md"),
  read("FREE_POSTGRES_DEADLINE_DECISION.md")
]);

// This is a documentation safety contract, NOT evidence of a real backup.
// Fail if the published template accidentally defaults any approval to YES.
assert.match(template, /Gesamtstatus:\s*GESPERRT/);
assert.match(template, /09\.12\.2026/);
for (const label of [
  "Kostenprüfung", "Export-/Restore-Zugriffsberechtigung",
  "Verschlüsselung", "Isolierte Zielumgebung",
  "Schema-Fingerprint", "Staging-DB-Identität",
  "Produktionsdeploy separat freigegeben"
]) {
  const line = template.split("\n").find(value => value.startsWith("| " + label));
  assert.ok(line, `Required operator evidence field missing: ${label}`);
  assert.match(line, /(?:OFFEN|NEIN|nicht nachgewiesen)/i,
    `Operator evidence must default to unapproved: ${label}`);
}
for (const document of [gates, deadline]) {
  assert.match(document, /09\.12\.2026/);
  assert.match(document, /Restore/i);
  assert.match(document, /Staging/i);
  assert.match(document, /Freigabe/i);
}
assert.match(gates, /kein.*(?:Produktiv|Produktions)deploy/i);
assert.match(deadline, /Keine Änderung an Render/i);
console.log("Operator release-gate docs: blocked defaults, deadline, backup/restore and staging controls.");
