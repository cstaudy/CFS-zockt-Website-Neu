# CFS-Zockt – vollständiger Codex-Audit

**Prüfdatum:** 23.11.2026  
**Quelle:** `main` bei Commit `7808447a26fc51d906e97bfc81d7cae4baed83cd`  
**Ausgangsissue:** [#99](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/99)  
**Audit-Branch:** `audit/codex-full-review-2026-11-23`

## Ergebnis in einem Satz

Die Anwendung enthält auf `main` eine große, überwiegend lokal testbare Funktionsbasis und die in PR #97 eingeführte Export-Sperre. Ein Merge-/Deploy-„READY“ ist trotzdem nicht belegt: Das kostenlose Render-PostgreSQL läuft auf eine dokumentierte Frist zu, ein verschlüsseltes dauerhaftes Backup mit isoliertem Restore ist nicht nachgewiesen, `main` ist nicht geschützt, und mehrere offene PRs sind Konflikt-, Stack- oder Umfangskandidaten.

Dieser Audit hat **keine** Produktionsdatenbank beschrieben, **keinen** Produktions-Export gestartet, **keinen** Render-Deploy ausgelöst und **keinen** bestehenden PR geändert, freigegeben, geschlossen oder gemerged.

## Prüfrahmen und Quellen

- Verbindliche Projektanweisungen: `AGENTS.md`, `CODEX_START_HIER.md`, `codex_handover/CODEX_AUFTRAG_KOPIEREN.md`.
- Vergleichsdokumente: `codex_handover/VERGLEICHSBERICHT.md`, `FEATURE_ENTSCHEIDUNGSMATRIX.csv`, `DATEIVERGLEICH.csv`.
- Website 3 bleibt die einzige Codebasis. Die älteren Archive sind nur Referenzquellen; es wurde nichts blind übernommen.
- Die sechs Referenzbilder unter `codex_handover/referenzbilder/` bleiben verbindliche Designvorlagen. Dieser Audit nimmt keine visuellen Änderungen vor.
- Alle 14 derzeit offenen PRs wurden über GitHub geprüft. Der historische Readiness-Bericht ist unter `audit/open-pr-merge-readiness-2026-11-22` nachvollziehbar.

## Offene PRs – Einstufung

„Mergeable“ in der GitHub-API ist nur ein technischer Branch-Zustand und keine Freigabe für Datenbank, Sicherheit oder Produktion.

| PR | Thema / technische Lage | Einstufung | Nächster sicherer Schritt |
|---:|---|---|---|
| #11 | Design-System v2, Konflikt gegen `main`; konkurriert mit #12 | **NEEDS SPLIT** | Eine Designquelle auswählen, visuell gegen die sechs Referenzen prüfen, dann neu auf `main` aufbauen |
| #12 | Referenzsystem v2, großer Lösch-/Ersetzungsdelta; konkurriert mit #11 | **NEEDS SPLIT** | Nicht blind mergen; Unterschiede und verlorene Abhängigkeiten prüfen |
| #26 | Ältere Admin-/Verified-Role-Implementierung | **SUPERSEDED** | Gegen #47/#52 und den aktuellen `main`-Stand ablösen, nicht parallel mergen |
| #33 | MFA Login-Challenge, Migration 022, Basis für Stack | **BLOCKED** | Nur als Teil eines konsolidierten, auf `main` rebasierten MFA-PRs weiterführen |
| #34 | Gehashte Recovery-Codes, baut auf #33 auf | **BLOCKED** | Stack erst nach konsolidierter Basis und isoliertem Restore prüfen |
| #35 | Atomisches MFA-Deaktivieren, baut auf #34 auf | **BLOCKED** | In konsolidierten MFA-PR überführen |
| #36 | Atomisches Aktivieren/Rotieren, baut auf #35 auf | **BLOCKED** | In konsolidierten MFA-PR überführen |
| #37 | Recovery-Rotations-Cooldown, Migration 023 | **BLOCKED** | Migrationen und Lockout-Verhalten isoliert testen |
| #41 | TOTP-Replay-Schutz, Migration 024 | **BLOCKED** | Mit dem MFA-Stack rebasiert prüfen |
| #42 | Challenge-Issuance-Limit, Migration 025 | **BLOCKED** | Rate-Limit-/Lockout-Tests und Restore-Nachweis ergänzen |
| #43 | Konsistente Lock-Reihenfolge, baut auf #42 auf | **BLOCKED** | Erst nach dem MFA-Stack und DB-Review übernehmen |
| #47 | Ältere Current-Main-Admin-Implementierung | **SUPERSEDED-KANDIDAT** | Mit #52 vergleichen; genau eine Admin-Variante behalten |
| #50 | 265 Commits, 85 Dateien; Creator/OBS/Launcher/Twitch und Migrationen | **NEEDS SPLIT** | Nach Domänen (Creator, OBS, Integrationen, Migrationen) teilen; keine Sammelübernahme |
| #52 | Aktuelle Verified-Admin-Variante mit Operator-Preflight | **BLOCKED** | Isolierten Restore, echten Betreiber-Read-only-Preflight und Rollback dokumentieren |

Keine dieser Einstufungen markiert einen bestehenden PR als ready, merged oder geschlossen.

## Backup-, Restore- und Render-Befund

### P0 – vor jedem Produktionsschritt

1. Issue [#93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) dokumentiert die Free-Postgres-Frist **09.12.2026 18:36:16 UTC (19:36 MEZ)**. Eine kostenfreie Fortsetzung ist nicht verbindlich entschieden.
2. PR #97 ist in `main` gemerged und hält den Produktions-Export hart deaktiviert (`if: ${{ false }}`). Das ist eine Schutzmaßnahme, aber kein Backup-Nachweis.
3. Der historische Workflow-Lauf [45014794902](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45014794902) war erfolgreich. Er verwendete `pg_dump --format=custom --no-owner --no-acl`, stellte in eine leere Neon-Datenbank wieder her und verglich ausschließlich **26 gegen 26 Tabellen**. Der Dump war ein temporärer Runner-Artefakt und kein verschlüsseltes, dauerhaft verwahrtes Backup. Dieser Audit hat den Lauf nicht wiederholt.
4. Für den sicheren Produktionspfad fehlen weiterhin nachgewiesene Schlüsselverwahrung, unabhängige Aufbewahrung, vollständige Daten-/Schema-/Berechtigungsprüfung, Restore-Abbruchweg und Betreiberfreigabe. Die vorhandene Vorlage `DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md` steht deshalb korrekt auf `GESPERRT`.

### Sicherheitsbefunde

- `scripts/backup/pg18_backup_crypto.py` verwendet AES-256-GCM mit 32-Byte-Schlüssel, AAD und 0600-Ausgabe; der Prozess puffert jedoch den Dump vollständig im Speicher und begrenzt ihn auf 1 GiB.
- Die Backup-Workflows verwenden unpinned Action-/Container-Versionen und installieren Laufzeitpakete auf dem Runner; CA-/`verify-full`-Voraussetzungen und Schlüssel-Custody sind nicht vollständig nachgewiesen.
- `main` ist laut GitHub-API nicht geschützt (`protected: false`), erforderliche Statusprüfungen sind nicht konfiguriert.
- Es wurde keine Secret-Ausgabe, kein Produktions-Login und keine echte OAuth-/Payment-/OBS-Verbindung ausgeführt.

## Lokale Testbilanz

Ausgeführt im isolierten Clone mit `npm ci` (14 Pakete, 0 gemeldete npm-Schwachstellen).

### Bestanden

`node --check server.js`, lokale Asset-/Boundary-/Request-Tests, Upload-/Quota-/Media-Tests, MFA-Guard, Public Home, HTML-Integrität, Login-Destination, Passwort-/TOTP-/Throttle-/Recovery-Code-Tests, Migrationsbaseline 001–021, Legacy-Baseline, Public-Games-/Home-/PlayStation-Tests, Widget-/Scene-/Public-Output-/Runtime-Tests, Cut-/Stream-Studio-Tests, Twitch-Provider-/Revoke-Tests, Legacy-Schema-Shape und die übrigen JavaScript-Syntaxprüfungen liefen erfolgreich.

### Nicht als Produktfehler zu werten, aber auf Windows blockiert

- `npm run check` stoppt bei `bash -n scripts/test-pg18-backup-restore.sh`, weil in der Audit-Umgebung kein Bash/WSL vorhanden ist.
- `test-pg18-backup-refusal.mjs`, `test-admin-readiness.mjs`, `test-scene-output.mjs` und `test-release-readiness.mjs` können ihre untergeordneten Prozesse unter Windows wegen `spawnSync ... node.exe EPERM` nicht starten; dadurch sind `stderr`-Assertions nicht auswertbar.
- `test-operator-release-gates.mjs` meldet `0 !== 27`, weil die Datei CRLF-Zeilenenden enthält, der Test aber Zeilen ohne abschließendes `\r` erwartet. Das ist ein Testharness-/Portabilitätsbefund, keine Produktionsfreigabe.

Für eine grüne Gesamtauswertung sind Linux/WSL/CI sowie eine kleine, separat reviewbare Testharness-Anpassung erforderlich. Diese Anpassung wurde in diesem Audit nicht vorgenommen.

## Sicherer Umsetzungsplan

1. Betreiber entscheidet die kostenfreie Zielumgebung und dokumentiert die Freigabe.
2. In einer Wegwerf-Zielumgebung: verschlüsseltes Backup, Hash des verschlüsselten Artefakts, isolierter Restore, Schema-/Inventar-/aggregierte Plausibilitätsprüfung und Rollback-Nachweis.
3. MFA-Stack #33–#43 zu einem rebasierten PR konsolidieren; keine Migration ohne Restore-Nachweis.
4. Genau eine Admin-Variante (#47 oder #52, vorzugsweise die auf aktuellem `main` basierende) auswählen und den realen Betreiber-Read-only-Preflight auf der isolierten Kopie durchführen.
5. #50 in kleine, unabhängig testbare PRs teilen.
6. #11/#12 auf eine einzige Designänderung reduzieren und gegen die Referenzbilder abnehmen.
7. Erst danach Branch-Schutz/erforderliche Checks, Staging-Deploy und ein separat freigegebener Produktionsschritt.

## Rollback- und Abbruchregeln

Bei fehlendem Backup-/Restore-Nachweis, unklarer DB-Identität, fehlender Betreiberfreigabe, Lockout-Risiko oder roten Tests: stoppen. Keine Baseline, keine Migration, kein Produktivdeploy und kein Export. Der Audit-Branch enthält ausschließlich diese Dokumentation; bestehende Produktionsstände wurden nicht verändert.

