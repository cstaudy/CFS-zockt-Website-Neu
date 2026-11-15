# Entwicklungsplan – kostenlose Backup-/Staging-Freigabe

Stand: 14.11.2026. Separat von PR #89.

| Priorität | Schritt | Status | Freigabe-/Abnahmekriterium |
| --- | --- | --- | --- |
| P0 | PR #89 mit grüner CI abschließend reviewen | Technisch grün; Merge offen | Ausdrückliche Merge-Freigabe |
| P0 | Kostenfreies PostgreSQL-Ziel vor 09.12.2026 festlegen | Offen | Betreiber bestätigt Ziel und Frist |
| P0 | Echten verschlüsselten Produktions-Dump erstellen | Blockiert | Betreiberberechtigung, geschützter Speicher, Prüfsumme |
| P0 | Dump in separater Wegwerf-DB wiederherstellen | Blockiert | Erfolgreicher Restore, Inventar/Fingerprint und Rollback |
| P0 | Staging-DB technisch von Produktion trennen | Blockiert | Isolationsnachweis, kein Produktionsdatenzugriff |
| P1 | Read-only-Migrationspreflight und historische Baseline bewerten | Gesperrt | Backup + Restore + ausdrückliche Freigabe |
| P1 | Staging-Migration und Abnahmetests | Gesperrt | Getrennte DB, Restore, Rollback |
| P2 | Produktivdeploy entscheiden | Gesperrt | Alle Gates und Betreiberfreigabe |

## Fortsetzung
1. Dokumentationsänderung auf isoliertem Branch in CI prüfen und PR eröffnen.
2. Nur freigegebene, nicht geheime Nachweise erfassen; keine Produktionsdaten, Tokens oder Dumps in GitHub/Chat.
3. Mit Betreiberentscheidung zu kostenfreiem Datenbankziel und Restore-Fenster weiterarbeiten.
4. Bei jeder Änderung Übergabe und Plan fortschreiben. Kein Merge/Deploy ohne Freigabe.

Referenz: `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md`.

## Aktualisierung: Entscheidungsfenster vor dem 09.12.2026
- `docs/operations/FREE_POSTGRES_DEADLINE_DECISION.md` ergänzt die vier ausdrücklich **nicht vorab bestätigten** Optionen (Render-Free-Fortführung, anderer Free-PostgreSQL-Anbieter, kontrollierte Stilllegung mit gesichertem Export, nicht autorisierter Paid-Tarif).
- Betreiber-Planungsziele: 20.11. Verantwortliche/Optionen; 25.11. echter verschlüsselter Dump; 30.11. isolierter Restore; 04.12. kostenfreies Ziel; 07.12. Stop-/Freigabeentscheidung.
- PR #91 vorher grün (`a72e1a3`, Run `43631677494`); CI nach diesem Dokumentationsupdate erneut prüfen. Kein Merge/Deploy.

## Aktualisierung: Betreiber-Abnahmevorlage
- `docs/operations/DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md` hinzugefügt: keine Secrets, keine Dumps, alle Pflichtnachweise standardmäßig OFFEN/NEIN, Freigabestatus GESPERRT.
- Nächster Schritt: CI auf dem neuen HEAD prüfen, anschließend Draft-PR #91 reviewen; konkrete Restore-Befehle erst für ein durch Betreiber bestätigtes Ziel erstellen. Keine Kosten-/Verfügbarkeitsannahmen und keine automatischen DB-Aktionen.

## Aktualisierung: Sicherheitsregression im CI-Check
- `npm run check` führt jetzt `scripts/test-operator-release-gates.mjs` aus. Der Test verhindert unbemerkte Änderungen der Dokumentations-Standardwerte von GESPERRT/OFFEN/NEIN auf vermeintlich freigegeben und prüft die dokumentierten Backup-/Staging-Stop-Gates.
- Vorheriger HEAD `0bf5cd8` grün (Run `43632235907`); neue CI prüfen. Der Test ersetzt weder Betreiberentscheidung noch echten Restore.

## CI-Korrektur
- Neuer Dokumentations-Regressionscheck scheiterte am Wortlaut des bestehenden Freigabegates, nicht an der Anwendung. Die Assertion prüft nun die tatsächliche Formulierung `Produktivdeploy erst nach allen Gates` (Commit `afbffac`). CI erneut prüfen; ohne Grün kein Merge.

## Abschlussprüfung PR #91
- Code-/Dokumentationsdiff geprüft; HEAD `9319926` CI erfolgreich (Run `43633532666`), mergeable/clean.
- Review-Freigabe für PR-Diskussion möglich, aber **kein Merge ohne ausdrückliche Zustimmung**. Alle produktiven Backup-, Restore-, Staging- und Migrations-Gates bleiben gesperrt.
- Nächster sinnvoller Arbeitsschritt hängt von einer überprüften kostenfreien Zieloption und einer autorisierten echten Sicherung ab; keine spekulative Anbieter-/DB-Migration implementieren.

## Aktualisierung: vollständiger Vorlagen-Guard
- Der CI-Test prüft jetzt alle Nachweiszeilen (nicht nur sieben ausgewählte), erkennt unerwartete Tabellenverkürzung und enthält einen Negativtest für versehentliches `JA` bei Produktivdeploy.
- Ausgangsstand `dcf1bba` CI grün. Neue CI nach Teständerung abwarten; keine Freigaben oder Betriebsaktionen.

## Aktualisierung: Mutationstest sämtlicher Nachweise
- Der CI-Guard simuliert jetzt in jeder Betreiber-Nachweiszeile eine `JA`-Freigabe und verlangt jeweils einen Fehler; die Vorlage selbst bleibt unverändert.
- Vorheriger Stand `c6f6629` grün (Run `43636202088`); neue CI prüfen. Keine produktiven Aktionen.

## Aktualisierung: Pflichtfeld-Vollständigkeit
- 26 explizite Pflichtfelder sind jetzt als Dokumentationsvertrag im CI-Test erfasst. Für jede Zeile wird ein Löschversuch simuliert; Anzahl und Reihenfolge werden geprüft.
- Vorheriger Stand `b33a8ed` grün (Run `43636469792`); neuer Test-HEAD braucht CI. Keine Freigabe, Migration oder Deployment.

## Übergabe an Review / nächste Abhängigkeit
- CI HEAD `313d440` erfolgreich (Run `43638290828`), PR #91 konfliktfrei und review-bereit. Testpaket abgeschlossen; keine weitere Testausweitung ohne konkreten Fehler.
- Nächste Entscheidung: ausdrückliche Mergefreigabe für PR #89/#91 **separat**; unabhängig davon ist Produktionsfreigabe weiterhin gesperrt.
- Betreiber muss rechtzeitig vor 09.12.2026 eine nachweislich kostenlose PostgreSQL-Fortführung und einen autorisierten, verschlüsselten Backup-/isolierten Restore-Prozess bestätigen. Ohne diese Nachweise keine Migration oder Deployment.

## 15.11.2026 – Netzwerk-Härtung als zusätzliches P0-Betreiber-Gate

| Priorität | Aufgabe / Nachweis | Stand | Nächste Handlung |
| --- | --- | --- | --- |
| P0 | Render-Free-DB `cfs-zockt-db` vor **09.12.2026 18:36 UTC** absichern | Verfügbarkeit und exakt dokumentierte Frist **read-only bestätigt**; keine Fortführung garantiert | Bis 20.11. Verantwortliche und kostenloses Ziel bestätigen; 25.11. autorisierte verschlüsselte Sicherung, 30.11. isolierter Restore planen |
| P0 | DB-IPv4-Allowlist `0.0.0.0/0` auf tatsächlich erforderliche Zugänge begrenzen | **Offen**: aktueller breiter Netzwerkzugang read-only nachgewiesen, PostgreSQL-Zugangsschutz nicht umgangen | Bis 20.11. vom Betreiber die nötigen internen/externalen Clients, Wartungs- und Backupwege, erreichbare IPs, Ausfallrisiko und Rollback klären; erst nach separater Freigabe Änderung |
| P0 | Staging-Datenbank von Produktion isolieren | **Gesperrt**: getrennte DB nicht nachgewiesen; Staging und Produktion Auto-Deploy weiterhin aus | Technische Trennung durch Betreiber bestätigen; keine produktiven Daten nach Staging kopieren |
| P0 | Freigabeformular konservativ halten | Neues **27. Pflichtfeld** für DB-Netzwerkzugang standardmäßig `NEIN`; lokale CI-Dokumententest-Änderung | Aktuelle PR-CI prüfen; sämtliche `JA`- und Lösch-Mutationstests müssen grün sein |
| P1 | Security-PRs #89/#90 und Operations-PR #91 reviewen | Einzeln grün vor dieser Aktualisierung, ungemergt | Nur nach expliziter Mergefreigabe; anschließend kombinierte CI auf `main` |

**Achtung:** `0.0.0.0/0` öffnet die Netzwerk-Erreichbarkeit, nicht die DB-Authentifizierung. Die Allowlist darf **nicht blind** live verändert werden; interner Render-Zugriff, erlaubte externe Wartungs-IP und Notfall-Rückweg sind zuerst zu prüfen. Weder Render-Konfiguration noch Produktionsdatenbank wurden in dieser Runde verändert.

**Weiteres Vorgehen:** GitHub Actions auf dem aktuellen Branch-HEAD prüfen, einen Fehler im Dokumentationsvertrag ggf. korrigieren, PR #91 zur Review übergeben. Echte Produktiv-Backups/Restores und Kosten-/Deployfreigaben bleiben ausschließlich Betreiberaufgaben; **Gesamtstatus GESPERRT**.

## 15.11.2026 – Gate-A2-Absicherung: nächster Abnahmeschritt

| Priorität | Aufgabe | Nachweis / aktueller Status | Weiterarbeit |
| --- | --- | --- | --- |
| P0 | Breite DB-Allowlist in formaler Freigabetabelle führen | Gate A2 als **Offen** dokumentiert (`aeb82aa`, CI `43709288536` grün) | Betreiber klärt bis 20.11. tatsächliche interne/externe DB-Clients, Ausfallschutz und Rollback; **keine Konfigurationsänderung ohne Freigabe** |
| P0 | A2 gegen versehentliches Streichen oder vorzeitige Zustimmung schützen | Neuer Offline-Validator mit drei Negativmutationen: ganze A2-Sektion entfernen, `0.0.0.0/0` in A2 verdecken, Tabellenstatus auf `Bestanden` setzen (`f1b8d9b`). Erste Testfassung `e8b87d0` rot, Regex-Korrektur `4b46d01` nachgeschoben | **CI auf aktuellem Code- und Dokumentations-HEAD nachweisen**, keine Freigabe allein aus Teständerungen ableiten |
| P0 | Echter Produktions-Backup-/isolierter Restore | Weiterhin **GESPERRT**, nur Dokumentations- und Offline-Tests | Gesondert autorisierte verschlüsselte Sicherung und isolierter Wiederherstellungsbeweis |
| P0 | Staging-DB-Isolation, Ledger und Migrationsfreigaben | Weiterhin **GESPERRT** | Erst Betreiberentscheidung und echte technische Nachweise, dann geplanter isolierter Test |
| P1 | PR #91 Review und ggf. Integration | Vorheriger HEAD `7761e78` CI `43709000473` grün, ungemergt | Finale CI + Review; **ausdrückliche Mergefreigabe nötig**; danach Gesamt-CI auf `main` |

**Nächste Schritte:** CI des A2-Validators und finalen Heads prüfen; bei Fehler gezielt korrigieren. Am 20.11. kostenfreies Fortführungsziel und konkrete Berechtigung zur Netzwerkeinschränkung durch den Betreiber klären. Der Ablauf der kostenlosen DB ist `2026-12-09T18:36:16Z`. Kein automatisches Monitoring oder garantierter Datenexport wurde eingerichtet.

## 15.11.2026 – Umsetzbarer Betreiberablauf für die offene DB-Allowlist

| Priorität | Aufgabe | Status / Nachweis | Verantwortlicher nächster Schritt |
| --- | --- | --- | --- |
| P0 | Breite IPv4-Erreichbarkeit `0.0.0.0/0` kontrolliert begrenzen | Weiter **OFFEN**, nicht geändert; separates Operator-Runbook `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` erstellt (`659084c`, CI `43709699102` grün) | Bis zum Planungsziel **20.11.** berechtigte DB-Clients, interne Render-Verbindungen, externe Backups, dynamische Adressen und Rückweg ohne Secrets inventarisieren |
| P0 | Unbelegte Netzwerkfreigabe verhindern | Checkliste enthält 11 `OFFEN`-/`NEIN`-Zeilen; `Gesamtstatus: GESPERRT`; neuer Offline-Guard `2dc7971` prüft Inhalt und negative `JA`-Mutation | **CI des neuen Code- und Dokumentations-HEAD prüfen**; erst bei grüner CI für technische Review bereit |
| P0 | Sicheres kostenfreies DB-Ziel, echter Dump und isolierter Restore | **GESPERRT**; Free-DB-Ende **09.12.2026 18:36:16 UTC** bleibt bestätigt | Kostenfreie Fortführung und Betreiberberechtigung klären, autorisierten verschlüsselten Dump und isolierte Wiederherstellung mit Nachweis planen |
| P0 | Staging, Migration und Produktivdeploy | Ohne getrennte Staging-DB, Ledger-/Baseline-Entscheidung und gesonderte Betreiberfreigabe **GESPERRT** | Nichts deployen oder migrieren; alle Abnahme-Gates separat nachweisen |

**Stop-Entscheid:** Sollte irgendein notwendiger DB-Zugangsweg, eine Backup-Verbindung, die Rückfallmöglichkeit oder die Betreiberfreigabe fehlen, **keine** Live-Allowlist-Änderung. Die Checkliste ist keine tatsächliche Prüfung oder Zusage für die Verfügbarkeit einer kostenfreien Render-Option.

**Nächste Entwicklungsrunde:** die vollständige CI nach `2dc7971` und dem Dokumentations-HEAD verifizieren, bei Befund korrigieren, dann PR #91 als review-bereit belassen. Keine neuen Tests ohne konkrete Fehlstelle; die nächste reale Aktion erfordert Betreiberentscheidung. Weiterhin zu jeder Aktualisierung **Übergabe und Entwicklungsplan** fortschreiben.

## 15.11.2026 – Pflichtfeld-Vertrag für die Netzwerk-Checkliste

| Priorität | Aufgabe | Fortschritt | Nächster Schritt |
| --- | --- | --- | --- |
| P0 | Netzwerk-Freigabeformular vollständig halten | `6a29cf1`: 11 exakte Felder und Reihenfolge als Offline-Vertrag; je Feld unerlaubtes `JA` und Löschen negativ getestet | Neue CI für Testcommit und aktuellen Dokumentations-HEAD prüfen; bei Fehler gezielt korrigieren |
| P0 | Gate A2 und zugehörige Checkliste verknüpfen | Querverweise zwischen `PRODUCTION_BACKUP_STAGING_GATE.md` und `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` automatisch geprüft | Review im offenen PR #91; **keine** Freigabe durch CI |
| P0 | Kostenfreie DB-Fortführung bis 09.12.2026 absichern | Ablauf 09.12.2026 18:36 UTC bestätigt, Fortsetzung nicht bestätigt | Betreiberentscheidung zu zulässiger kostenfreier Option und DB-Netzwerkzugängen bis Planungsziel **20.11.2026** |
| P0 | Produktivbackup, isolierter Restore, Staging-Trennung | **GESPERRT**; echte Betriebsnachweise und Genehmigungen fehlen | Nur autorisierte Betreiber können Nachweise erbringen; weder SQL noch Dump, Migration, IP-Änderung oder Deployment eigenständig ausführen |

**Stoppregel:** Grüne CI heißt lediglich, dass die unveränderten, nicht freigegebenen Vorlagen konsistent sind – niemals, dass eine echte Backup-/Netzwerk-/Staging-Prüfung stattfand. Kein Merge von #89/#90/#91 ohne ausdrückliche Freigabe; nach einem genehmigten Merge vollständige CI auf aktualisiertem `main` prüfen. Übergabe: `docs/handover/2026-11-14-backup-staging-gates.md`.
