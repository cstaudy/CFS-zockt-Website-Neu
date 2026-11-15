import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../docs/operations/", import.meta.url);
const read = name => readFile(new URL(name, root), "utf8");

const [template, gates, deadline, networkChecklist, backupRunbook] = await Promise.all([
  read("DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md"),
  read("PRODUCTION_BACKUP_STAGING_GATE.md"),
  read("FREE_POSTGRES_DEADLINE_DECISION.md"),
  read("DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md"),
  read("PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md")
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
const hiddenWideExposure = gates.replace(
  "2. Für die derzeit offene IPv4-Allowlist `0.0.0.0/0`",
  "2. Für die derzeit offene IPv4-Allowlist `10.0.0.0/8`"
);
assert.notEqual(hiddenWideExposure, gates, "Network exposure mutation fixture failed");
assert.throws(() => validateNetworkGate(hiddenWideExposure), /Network gate missing/);
const prematurelyApprovedNetwork = gates.replace(
  "| A2 – DB-Netzwerkzugang | Offen |",
  "| A2 – DB-Netzwerkzugang | Bestanden |"
);
assert.notEqual(prematurelyApprovedNetwork, gates, "Network approval mutation fixture failed");
assert.throws(() => validateNetworkGate(prematurelyApprovedNetwork),
  /must remain open/);
// The supplemental network operator checklist is a planning aid, not approval.
// Its 11 explicit decision/evidence rows must all remain OFFEN or NEIN.
assert.match(networkChecklist, /Gesamtstatus:\s*GESPERRT/);
assert.match(networkChecklist, /0\.0\.0\.0\/0/);
assert.match(networkChecklist, /20\.11\.2026/);
assert.match(networkChecklist, /Rückweg/);
const requiredNetworkChecklistLabels = [
  "Verantwortliche Betreiberrolle und ausdrückliche Prüferlaubnis dokumentiert",
  "Produktive Render-interne DB-Verbindung und ihr Geltungsbereich bestätigt",
  "Alle berechtigt externen Clients (Wartung, Export, Restore, Monitoring) nach Funktion inventarisiert",
  "Relevante feste oder wechselnde Client-IP-Adressen **außerhalb des Repositories** geschützt verifiziert",
  "Staging-Zugriff und Staging-DB **technisch getrennt** von Produktion belegt",
  "Abhängigkeiten von Backups, Notfallzugriff und Anwendungsstart bewertet",
  "Erforderliche Verbindungswege und geeignete sichere Einschränkung bestätigt?",
  "Betreiber und Rückweg für geplante Netzwerkänderung ausdrücklich freigegeben?",
  "Durchgeführte Änderung, Verbindungstests und Fehlerfreiheit nachgewiesen?",
  "Produktionsbackup mit isoliertem Restore erfolgreich nachgewiesen?",
  "Freigabe von Migration, Staging und Produktivdeployment erteilt?"
];
const networkChecklistRows = markdown => markdown.split("\n")
  .filter(line => /^\| .+ \| .+ \|$/.test(line))
  .filter(line => !/^\| (?:Nachweis|Entscheidung|---)/.test(line));
function validateNetworkChecklist(markdown) {
  const rows = networkChecklistRows(markdown);
  assert.equal(rows.length, requiredNetworkChecklistLabels.length,
    "Network checklist evidence/decision rows changed");
  const cells = rows.map(line => line.slice(1, -1).split("|").map(cell => cell.trim()));
  for (const columns of cells) {
    assert.equal(columns.length, 2, "Unexpected network checklist column count");
  }
  assert.deepEqual(cells.map(columns => columns[0]), requiredNetworkChecklistLabels,
    "Network checklist labels missing, duplicated or reordered");
  for (const [label, status] of cells) {
    assert.match(status, /^(?:OFFEN|NEIN)(?:$|\s)/,
      `Network checklist must remain unapproved: ${label}`);
  }
}
validateNetworkChecklist(networkChecklist);
for (const row of networkChecklistRows(networkChecklist)) {
  const label = row.slice(1, -1).split("|")[0].trim();
  const prematurelyApproved = networkChecklist.replace(row, `| ${label} | JA |`);
  assert.notEqual(prematurelyApproved, networkChecklist, "Checklist approval mutation failed");
  assert.throws(() => validateNetworkChecklist(prematurelyApproved),
    /Network checklist must remain unapproved/,
    `Unapproved network checklist row must fail: ${label}`);

  const removed = networkChecklist.replace(row + "\n", "");
  assert.notEqual(removed, networkChecklist, "Checklist row removal mutation failed");
  assert.throws(() => validateNetworkChecklist(removed),
    /Network checklist evidence\/decision rows changed/,
    `Removing network checklist row must fail: ${label}`);
}
assert.match(gates, /DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST\.md/,
  "Release Gate A2 must link to the operator checklist");
assert.match(networkChecklist, /Gate A2/,
  "Operator checklist must refer back to release Gate A2");
// A real production dump is operator-only. Check that the new manual runbook
// cannot silently lose its STOP gates or imply that CI proves a real restore.
const requiredBackupApprovalLabels = [
  "Zuständige Betreiberrolle und ausdrückliche Erlaubnis für **Produktiv-Datenexport** dokumentiert",
  "Kostenfreie, rechtlich zulässige und zugriffsgeschützte **externe Ablage** bestätigt",
  "Geeignetes Verschlüsselungsverfahren und getrennte Schlüsselverwaltung bestätigt",
  "PostgreSQL-18-kompatible Clientwerkzeuge sowie benötigter DB-Netzwerkzugang bestätigt",
  "Konkretes Backup-Fenster, Speicherplatz und ausreichend Zeit vor 09.12.2026 bestätigt",
  "Kostenfreie **isolierte Restore-Zielumgebung** und technische Trennung von Produktion belegt",
  "Datenschutz, Aufbewahrungsdauer, Vertraulichkeit und geregelte Löschung freigegeben",
  "Rollback-/Notfallverantwortliche und Abbruchweg bestätigt"
];
const backupRows = markdown => {
  const section = markdown.split("## 2. Stop-Gates vor einem echten Export")[1]
    ?.split("## 3.")[0] ?? "";
  return section.split("\n").filter(line => /^\| .+ \| .+ \|$/.test(line))
    .filter(line => !/^\| (?:Zwingende Vorbedingung|---)/.test(line));
};
function validateBackupRunbook(markdown) {
  const rows = backupRows(markdown).map(row =>
    row.slice(1, -1).split("|").map(cell => cell.trim()));
  assert.deepEqual(rows.map(row => row[0]), requiredBackupApprovalLabels,
    "Operator backup prerequisites changed without review");
  for (const [label, value] of rows) {
    assert.equal(value, "OFFEN", `Backup prerequisite must remain OFFEN: ${label}`);
  }
  assert.match(markdown, /GESAMTSTATUS:\s*GESPERRT/);
  assert.match(markdown, /pg_dump -Fc/);
  assert.match(markdown, /pg_restore --list/);
  assert.match(markdown, /--exit-on-error/);
  assert.match(markdown, /kein.*automatischen Migrationen/i);
  assert.match(markdown, /09\.12\.2026/);
  // With --no-owner/--no-acl the archive cannot restore original object
  // owners or GRANT/REVOKE commands. A successful restore is not app-ready.
  const restoreSection = markdown.split("## 4. Getrennter Restore")[1]
    ?.split("## 5. Entscheidung")[0] ?? "";
  assert.match(restoreSection, /--no-owner.*--no-acl/,
    "Runbook must disclose omitted object owners and privileges");
  assert.match(restoreSection, /GRANT/,
    "Runbook must require separate database role and privilege validation");
  assert.match(restoreSection, /Indizes.*Foreign Keys.*Constraints.*Trigger.*Sequenzstände.*Erweiterungen/,
    "Runbook must require non-column schema dependency checks");
  assert.match(restoreSection, /Test-Anwendungsrolle/,
    "Runbook must require an isolated minimal-privilege app check");
  assert.match(restoreSection, /STOPP/,
    "Missing restore role or dependency checks must block release");
  assert.match(markdown, /globalen? Clusterobjekte/,
    "Single-database dumps must not be mistaken for role backups");
}
validateBackupRunbook(backupRunbook);
for (const line of backupRows(backupRunbook)) {
  const approved = backupRunbook.replace(line, line.replace("| OFFEN |", "| JA |"));
  assert.notEqual(approved, backupRunbook, "Backup mutation fixture failed");
  assert.throws(() => validateBackupRunbook(approved),
    /Backup prerequisite must remain OFFEN/);
  const removed = backupRunbook.replace(line + "\n", "");
  assert.notEqual(removed, backupRunbook, "Backup removal fixture failed");
  assert.throws(() => validateBackupRunbook(removed),
    /Operator backup prerequisites changed/);
}
assert.match(gates, /--no-owner --no-acl.*nicht.*wieder her/,
  "Gate C must flag missing restored owner/privilege grants");
assert.match(gates, /Rechte-\/Abhängigkeitsprüfung/,
  "Gate C cannot pass on a simple dump/restore exitcode alone");
assert.match(gates, /PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK\.md/,
  "Gate C must link to the operator-only backup runbook");
assert.match(gates, /Produktivdeploy erst nach allen Gates/i);
assert.match(deadline, /Keine Änderung an Render/i);
console.log("Operator release-gate docs: blocked defaults, deadline, backup/restore and staging controls.");
