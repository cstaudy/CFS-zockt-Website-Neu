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
  "DB-Netzwerkzugang", "Verschlüsselung", "Isolierte Zielumgebung",
  "Schema-Fingerprint", "Staging-DB-Identität",
  "Produktionsdeploy separat freigegeben"
]) {
  const line = template.split("\n").find(value => value.startsWith("| " + label));
  assert.ok(line, `Required operator evidence field missing: ${label}`);
  assert.match(line, /(?:OFFEN|NEIN|nicht nachgewiesen)/i,
    `Operator evidence must default to unapproved: ${label}`);
}
// Check all 27 evidence rows, not just a small set of named critical fields.
const requiredEvidenceLabels = [
  "Freigebende Rolle / Kontaktkanal (keine privaten Kontaktdaten)",
  "Kostenfreie Zieloption und verbindlich geprüfte Bedingungen",
  "Kostenprüfung (0 zusätzliche EUR bestätigt?)",
  "Export-/Restore-Zugriffsberechtigung geprüft?",
  "DB-Netzwerkzugang und erforderliche Client-Ausnahmen geprüft?",
  "Datenschutz-/Aufbewahrungsfreigabe?",
  "Sicherungszeitpunkt (UTC)",
  "PostgreSQL-Server- und Client-Hauptversion",
  "Konsistentes Dump-Verfahren und Exitcode",
  "Verschlüsselung nach Betreiberstandard bestätigt?",
  "Speicherort unabhängig von Render, Zugriff beschränkt (nur allgemeine Beschreibung)",
  "SHA-256 des **verschlüsselten** Artefakts",
  "Lesbarkeit und Aufbewahrungsdauer geprüft?",
  "Isolierte Zielumgebung nachweislich getrennt von Produktion?",
  "Ziel als Wegwerf-DB bestätigt, keine produktiven Clients verbunden?",
  "Restore-Zeitpunkt (UTC), Exitcode, verwendete Tool-Version",
  "Tabellen-/Schema-Inventar gegen Quelle geprüft (ohne Datensätze)?",
  "Unkritische aggregierte Zählwerte plausibel?",
  "Schema-Fingerprint geprüft?",
  "Restore-/Rollback-Verantwortliche und Abbruchweg dokumentiert?",
  "Staging-DB-Identität technisch verschieden von Produktion?",
  "Staging-Datenherkunft und Zugriffskontrolle freigegeben?",
  "Read-only-Preflight ausgeführt und dokumentiert?",
  "Historisches Ledger/Schema vollständig geklärt?",
  "Migration 001–021-Baseline separat freigegeben?",
  "Migration 022–025 separat freigegeben?",
  "Produktionsdeploy separat freigegeben?"
];
function validateEvidenceRows(markdown) {
  const rows = markdown.split("\n").filter(line => /^\| .+ \| .+ \|$/.test(line));
  const evidence = rows.filter(line => !/^\| (?:Feld|---|Render-Free-Ablauf)/.test(line));
  assert.equal(evidence.length, requiredEvidenceLabels.length, "Evidence row count changed");
  assert.deepEqual(evidence.map(row => row.slice(1, -1).split("|")[0].trim()),
    requiredEvidenceLabels, "Evidence labels missing, duplicated or reordered");
  for (const row of evidence) {
    const [label, value] = row.slice(1, -1).split("|").map(part => part.trim());
    assert.ok(label && value, "Empty operator evidence field");
    assert.match(value, /^(?:OFFEN|NEIN)(?:$|\s)/i,
      `Evidence must remain unapproved: ${label}`);
  }
}
validateEvidenceRows(template);
// Mutation test: a premature YES in any operator evidence row must fail.
const evidenceLines = template.split("\n").filter(line =>
  /^\| .+ \| .+ \|$/.test(line) &&
  !/^\| (?:Feld|---|Render-Free-Ablauf)/.test(line));
for (const line of evidenceLines) {
  const label = line.slice(1, -1).split("|")[0].trim();
  const changed = template.replace(line, `| ${label} | JA |`);
  assert.notEqual(changed, template, `Mutation must alter evidence row: ${label}`);
  assert.throws(() => validateEvidenceRows(changed), /Evidence must remain unapproved/,
    `Premature approval must be rejected: ${label}`);
}
// Mutation test: removing any evidence row must fail, even when many rows remain.
for (const line of evidenceLines) {
  const changed = template.replace(line + "\n", "");
  assert.notEqual(changed, template, "Deletion must alter the evidence template");
  assert.throws(() => validateEvidenceRows(changed), /Evidence row count changed/);
}
for (const document of [gates, deadline]) {
  assert.match(document, /09\.12\.2026/);
  assert.match(document, /Restore/i);
  assert.match(document, /Staging/i);
  assert.match(document, /Freigabe/i);
}
// Protect the new DB-network exposure gate against silent removal or false
// approval. This tests the documentation contract, not a live Render setting.
function validateNetworkGate(document) {
  const start = document.indexOf("## Gate A2:");
  assert.ok(start >= 0, "Gate A2 for database network exposure is missing");
  const end = document.indexOf("\n## ", start + 1);
  assert.ok(end > start, "Gate A2 must be a standalone section");
  const section = document.slice(start, end);
  for (const [description, required] of [
    ["existing wide IPv4 allowlist", /0\.0\.0\.0\/0/],
    ["actual required database connections", /DB-Verbindungswege/],
    ["separate web and database access", /Web-Service-URLs/],
    ["rollback before restriction", /Rückweg/],
    ["explicit operator authorization", /ausdrücklicher Freigabe/],
    ["unapproved default", /\*\*OFFEN\*\*/]
  ]) {
    assert.match(section, required, `Network gate missing: ${description}`);
  }
  const summary = document.split("\n").find(line =>
    line.startsWith("| A2 – DB-Netzwerkzugang |"));
  assert.ok(summary, "Network gate missing from formal status table");
  assert.match(summary, /\| Offen \|/,
    "Network gate must remain open until an authorized decision");
}
validateNetworkGate(gates);
const missingNetworkGate = gates.replace(
  /## Gate A2:[\s\S]*?(?=\n## Gate B:)/, ""
);
assert.notEqual(missingNetworkGate, gates, "Network gate removal fixture failed");
assert.throws(() => validateNetworkGate(missingNetworkGate), /Gate A2/);
const hiddenWideExposure = gates.replace("`0.0.0.0/0`", "`10.0.0.0/8`");
assert.notEqual(hiddenWideExposure, gates, "Network exposure mutation fixture failed");
assert.throws(() => validateNetworkGate(hiddenWideExposure), /Network gate missing/);
const prematurelyApprovedNetwork = gates.replace(
  "| A2 – DB-Netzwerkzugang | Offen |",
  "| A2 – DB-Netzwerkzugang | Bestanden |"
);
assert.notEqual(prematurelyApprovedNetwork, gates, "Network approval mutation fixture failed");
assert.throws(() => validateNetworkGate(prematurelyApprovedNetwork),
  /must remain open/);
assert.match(gates, /Produktivdeploy erst nach allen Gates/i);
assert.match(deadline, /Keine Änderung an Render/i);
console.log("Operator release-gate docs: blocked defaults, deadline, backup/restore and staging controls.");
