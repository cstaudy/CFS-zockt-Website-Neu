# Produktiv-Backup, Restore und Staging-Isolation – Freigabegates

Stand: 15.11.2026. **Nur Planung; keine Produktionszugriffe, Datenexporte, Migrationen oder Deployments.**

## Bekannte Ausgangslage
- Render PostgreSQL `cfs-zockt-db`: Free-Plan, Ablauf laut Render-Metadaten am **09.12.2026 um 18:36 UTC**. Laut aktueller [Render-Free-Dokumentation](https://render.com/docs/free) endet Free-Postgres nach 30 Tagen; danach ist die DB unzugänglich, die 14-tägige Nachfrist dient einem **kostenpflichtigen Upgrade**, danach droht Datenlöschung. **Keine reguläre kostenlose Verlängerung**, keine zweite gleichzeitige Free-DB pro Workspace bestätigt. Sicherung vor Ablauf und kostenfreie Migration mit Betreiber rechtzeitig klären.
- Read-only-Befund vom 14.11.: bestehende `accounts`-Tabelle, aber kein `schema_migrations`-Ledger und keine MFA-Challenge-Tabelle. Historische Baseline ist **nicht** automatisch erlaubt.
- **Read-only-Render-Befund vom 15.11.2026:** DB `cfs-zockt-db` ist verfügbar, PostgreSQL 18, Free, tatsächlicher Render-Ablauf `2026-12-09T18:36:16Z`. Der DB-`ipAllowList` enthält `0.0.0.0/0` (`everywhere`). Dies erlaubt Netzwerk-Verbindungsversuche aus dem gesamten IPv4-Raum, **nicht** automatisch authentifizierten Datenzugriff. Ohne überprüfte benötigte Verbindungswege und gesonderte Betreiberfreigabe die Allowlist **nicht** live ändern.
- Render-Staging hat derzeit **keine nachgewiesen isolierte Datenbank**. Staging-Dienst und Produktionsdienst haben Auto-Deploy deaktiviert.
- Die CI-Tests nutzen eine **flüchtige, isolierte PostgreSQL-18-Datenbank**. Ihr erfolgreicher Dump/Restore ist kein Nachweis für die echte Produktionsdatenbank.
- **CI-Regression ab 15.11.2026:** `scripts/test-pg18-backup-restore.sh` richtet in derselben strikt geschützten, flüchtigen PG18-CI **zusätzliche synthetische Datenbanken und NOLOGIN-Testrollen** ein. Der Test beweist, dass ein `--no-owner --no-acl`-Restore die Testzeile erhält, aber bewusst **ursprünglichen Tabelleneigentümer und SELECT-GRANT nicht übernimmt**. Das ist ein **Nachweis des Risikenmechanismus**, nicht eine Rollen-/Backup-/Restore-Abnahme der Produktionsdatenbank. Nach der Probe werden Rollen, Datenbanken und temporäre Dumps entfernt.

## Gate A: Betreiberentscheidung vor Ablauf
1. Betreiber bestätigt Eigentümer, zulässige Zugriffsmethode, voraussichtliche Datenmenge, Frist und ein **kostenfreies** Fortführungsziel. Keine Zugangsdaten in GitHub, Tickets oder Logs ablegen.
2. Kein Löschen/Ersetzen der bestehenden Render-DB, kein Upgrade und kein Tarifwechsel ohne gesonderte ausdrückliche Freigabe.
3. Wenn kein kostenloses Ziel oder verifizierter Restore rechtzeitig verfügbar ist: **keinen** riskanten automatischen Umzug starten; Betreiber über Ablauf-/Verfügbarkeitsrisiko informieren.

## Gate A2: Datenbank-Netzwerkzugang risikobewusst eingrenzen (neu 15.11.)

1. Betreiber erfasst **ohne Secrets oder interne Verbindungsstrings** die tatsächlich benötigten DB-Verbindungswege (produktive Render-Web-Services, berechtigter Wartungs-/Backup-Client, eventuelle weitere ausdrücklich autorisierte Clients). Öffentlich erreichbare **Web-Service-URLs** nicht mit DB-Netzwerkregeln verwechseln.
2. Für die derzeit offene IPv4-Allowlist `0.0.0.0/0` einen begründeten Minimalzugangsplan erstellen. Die [Render-Dokumentation](https://render.com/docs/postgresql-creating-connecting) bestätigt: **Die DB-IP-Allowlist betrifft nur externe Verbindungen**; interne Datenbankverbindungen von Render-Diensten im selben Workspace und derselben Region über die **interne URL** sind davon nicht abhängig. Tatsächlich verwendete URL-Klasse (intern/extern) **ohne Secrets** durch den Betreiber prüfen; externe feste/dynamische Client-Adressen, Backup- und Notfallzugang berücksichtigen.
3. Vor jeder Änderung eine autorisierte, sichere Probe und einen konkreten Rückweg dokumentieren. Die Allowlist erst nach eigener ausdrücklicher Freigabe anpassen; keine produktive Verbindung durch einen ungeprüften Sofort-Fix aussperren.
4. Bis zur dokumentierten Prüfung bleibt dieses Sicherheitsthema **OFFEN**. Eine zugängliche Netzwerkadresse beweist keine fehlende Passwortprüfung, ist aber eine unnötig breite Angriffsfläche, sofern weniger Zugriff benötigt wird.
5. Der konkrete, **noch nicht freigegebene** Prüf- und Rückwegplan steht in `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md`. Er ersetzt weder echte Verbindungsvalidierung noch eine Betreiberfreigabe.

## Gate B: Echter Sicherungsnachweis
Nur ein autorisierter Betreiber darf eine echte Sicherung erstellen. Das Verfahren muss **nachweisbar**:
- einen konsistenten PostgreSQL-Dump aus der autorisierten Quelle **vor deren Ablauf** erzeugen, Zugangsdaten nicht ausgeben und den Dump verschlüsselt in einem zugriffsgeschützten, vom Live-Dienst unabhängigen Speicher ablegen. Render bietet für Free-Postgres [keine eigenen logischen Exporte oder PITR](https://render.com/docs/postgresql-backups); dafür kann ein **autorisierter Betreiber** von einem geeigneten Client `pg_dump` verwenden. **Das ist nur eine dokumentierte Möglichkeit, kein ausgeführter Export**;
- Zeitpunkt, PostgreSQL-/Tool-Version, verschlüsselte Dateigröße, SHA-256-Prüfsumme der **verschlüsselten** Datei, Aufbewahrungsort (ohne Secrets) und verantwortliche Person festhalten;
- sensible personenbezogene Daten ausschließlich gemäß Betreiber- und Datenschutzvorgaben behandeln. **Keine** Dumps, Klartext-Exporte, Token oder Verbindungsstrings in das Repository, CI-Artefakte oder Chat hochladen.

## Gate C: Isolierte Wiederherstellung
1. Vor dem Restore schriftlich nachweisen, dass das Ziel eine **separate Wegwerf-Datenbank** ist und keinerlei produktive Verbindung/Anwendung auf dieses Ziel zeigt.
2. Verschlüsselten Dump kontrolliert entschlüsseln und mit kompatiblen PostgreSQL-Werkzeugen in die isolierte DB wiederherstellen. Keine Produktionsmigration dabei ausführen.
3. Restore-Erfolg anhand Exitcodes, Schema-/Tabelleninventar, ausgewählten nichtpersonenbezogenen Zählwerten und Schema-Fingerprint verifizieren. **Zusätzlich** die Objekt-Eigentümer-/Rollen-/GRANT-Zuordnung, Indizes, Constraints, Trigger, Sequenzstände, Erweiterungen und erforderliche Funktionen im isolierten Ziel prüfen: `--no-owner --no-acl` stellt alte Berechtigungen **nicht** wieder her und ein Datenbank-Dump enthält keine globalen Rollen. Kein Dateninhalt im Prüfprotokoll, keine produktiven Secrets/Rollen importieren.
4. Einmaligen Wiederanlauf-/Rollback-Plan festhalten: wer stoppt den Rollout, welche Anwendungsversion bleibt aktiv, wie wird eine fehlerhafte Ziel-DB verworfen, und wie wird auf die gesicherte Ausgangslage zurückgekehrt?
5. Erst nach dokumentiertem erfolgreichen Restore **und einer separaten Rechte-/Abhängigkeitsprüfung** Gate C als bestanden markieren. Ein erfolgreicher `pg_restore`-Exitcode, ein Schema-Fingerprint oder `scripts/test-pg18-backup-restore.sh` in CI genügt ausdrücklich **nicht**. Eine isolierte Anwendungsprobe braucht eigene Freigabe, dedizierte Testrolle und deaktivierte externe Integration/Migrationsautomatik.
6. Das **nur nach separater Genehmigung zu verwendende** Operator-Runbook für tatsächlichen Export, Verschlüsselung und isolierten Restore steht in `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`; es enthält keine Ausführungsfreigabe.

## Gate D: Staging-Isolation
- Eindeutige getrennte DB-Identitäten für Produktion und Staging belegen, ohne Credentials offenzulegen. Eine andere Datenbankbezeichnung allein reicht nicht, wenn beide auf dieselbe Instanz/Datenbank zeigen.
- Staging benötigt eine eigene Datenbank oder eine vergleichbar **technisch getrennte**, ausdrücklich freigegebene Wegwerf-Umgebung. Die bisherige Staging-Konfiguration gilt bis dahin als gesperrt.
- Keine realen Nutzerdaten in Staging kopieren, solange Datenschutz und Zugriffskontrollen nicht ausdrücklich freigegeben sind.
- Erst danach Staging-Code-Stand, isolierte Migration, Smoke-/Browser-/OBS-Tests und Rollback testen. Kein automatischer Staging-Deploy.

## Gate E: Migration und Produktivfreigabe
1. Nach Gate B/C historischen Schemaabgleich mit `npm run release:preflight` **nur lesend** und dem dokumentierten Legacy-Fingerprint durchführen.
2. Eine 001–021-Baseline nur mit den bestehenden expliziten Opt-ins, nach tatsächlichem Restore-Nachweis und eigener Freigabe; 022–025 **niemals** als ausgeführt markieren, wenn sie fehlen.
3. Neue Migrationen und MFA/Admin-Funktionen erst isoliert testen, danach separate Freigabe und Rollback.
4. Produktivdeploy erst nach allen Gates und ausdrücklicher Betreiberentscheidung. CI-Grün oder ein gemergter PR ersetzen diese Entscheidung nicht.

## Abnahmeprotokoll (ohne Geheimnisse)
| Gate | Status 15.11.2026 | Benötigter Nachweis |
| --- | --- | --- |
| A – kostenfreies Ziel/Frist | Offen | Betreiberentscheidung und Ablaufplan |
| A2 – DB-Netzwerkzugang | Offen | Benötigte Clients und sichere Allowlist-Änderung mit Rückweg und separater Betreiberfreigabe |
| B – echter verschlüsselter Dump | Blockiert | Datum, SHA-256 der verschlüsselten Datei, geschützter Speicher |
| C – isolierter Restore | Blockiert | Wiederherstellungsprotokoll, Schema-/Fingerprint-Abgleich, Rollback |
| D – Staging getrennt | Blockiert | Technischer Trennungsnachweis und Staging-Testfreigabe |
| E – Migration/Deploy | Gesperrt | A–D, Migrationsabnahme, ausdrückliche Freigabe |

**Stop-Regel:** Unbekannte Verbindung, fehlende Sicherung, Schemaabweichung, Restore-Fehler, nicht isoliertes Staging oder unklare Kosten ⇒ **keine** Änderung an Produktion.
