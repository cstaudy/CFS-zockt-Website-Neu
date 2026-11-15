# Entwicklungsplan – P0-Datensicherung und kontrollierte Release-Freigabe

**Aktueller Stand: 15.11.2026 · Status: GESPERRT für Produktion.** Dies ist der konsolidierte Arbeitsstand für [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91). Ältere, teils inzwischen überholte CI-Zwischenstände bleiben im Git-Verlauf nachvollziehbar. Maßgeblich ist die tatsächlich ausgeführte CI auf dem jeweiligen HEAD.

## Ziel und Priorität

**Das Wichtigste ist die Sicherung der realen Nutzerdaten vor dem Ablauf der Render-Free-PostgreSQL-Datenbank.** Die Read-only-Render-Metadaten bestätigen **09.12.2026, 18:36:16 UTC** als Ablauf. Ein normales kostenloses Verlängerungsangebot, eine zweite aktive Free-DB im selben Workspace und ein automatisches Free-Backup dürfen nach den aktuellen [Render-Free-Bedingungen](https://render.com/docs/free) und [Backup-Regeln](https://render.com/docs/postgresql-backups) nicht vorausgesetzt werden.

Der neue **[P0-Betreiberauftrag #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93)** ist der zentrale Ort zur Nachverfolgung von Entscheidungen und **nicht geheimen** Abnahmen. Der Auftrag bleibt offen; das Erstellen des Issues ist **kein Backup-/Restore-Nachweis**.

## Priorisierte Arbeit und Gate-Abhängigkeiten

| Priorität / Termin (Planungsziel) | Aufgabe | Stand / Voraussetzung für Abnahme |
| --- | --- | --- |
| **P0 – 20.11.2026** | Berechtigte Betreiberrolle, echte Export-/Restore-Befugnis, kostenlose Zieloption, zulässige geschützte Ablage, Datensicherheit und benötigte DB-Clients entscheiden | **OFFEN** – [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93); keine bestätigte kostenfreie Fortführung |
| **P0 – 25.11.2026** | Verschlüsselten **echten** PostgreSQL-Custom-Dump **vor Ablauf** durch autorisierten Betreiber erstellen; SHA-256 der verschlüsselten Datei und unabhängigen Speicher nachweisen | **GESPERRT** – acht `OFFEN`-Vorbedingungen im `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`, kein ausgeführter Dump |
| **P0 – 30.11.2026** | Restore **in technisch getrennte, leere Wegwerf-DB**, mit neutralem Schema-/Daten-Nachweis und gesonderter Rolle-/Grant-/Indizes-/Trigger-/Sequenz-/Extension-Prüfung | **GESPERRT** – weder Zielisolation noch echter Restore oder Rechteprüfung nachgewiesen; `--no-owner --no-acl` überträgt Rechte nicht |
| **P0 – bis 04.12.2026** | Tatsächlich kostenlose, datenschutzkonforme und technisch tragfähige Fortführung wählen; Staging-DB-Trennung belegen | **GESPERRT** – keine zweite freie Render-Postgres im selben Workspace garantiert, Staging-Isolation nicht nachgewiesen |
| **P0 – bis 07.12.2026** | Gesonderte Stop-/Freigabeentscheidung vor DB-Ablauf; technische Baseline/Migration nur nach echten Backup-/Restore-/Schema-Gates | **GESPERRT** – fehlendes `schema_migrations`-Ledger in Produktion, Migrationen 022–025 nicht vorhanden |
| **P0 – nach Betreiberfreigabe** | DB-IPv4-Allowlist `0.0.0.0/0` risikobewusst auf erforderliche **externe** Zugänge begrenzen | **OFFEN** – produktiver interner/externer URL-Typ unbekannt; Backup-Clients und Notfallrückweg zuerst verifizieren. Kein blindes Sperren |
| **P1 – nach Review** | Security-PRs [#89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89), [#90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) und Operations-PR [#91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) separat prüfen | Einzel-PRs zuletzt grün/clean; **kein Review/Merge genehmigt**. #89/#90 berühren dieselbe E2E-Datei in verschiedenen Bereichen; kombinierte CI erst **nach genehmigter Integration** |
| **P1 – vor jedem Deploy** | Isolierte Staging-Migration, Browser-/OBS-/Admin-/Creator-Abnahme sowie Rollback | **GESPERRT** – technische Staging-DB-Trennung, wirkliche Restore-Abnahme und getrennte Deploymentfreigabe fehlen |

Die Daten sind **Zieltermine, keine automatischen Termine oder Ausführungszusagen**. Bei fehlender Betreiberberechtigung, unklaren Kosten, nicht nachgewiesener DB-Isolation oder Restore-/Rechtefehlern: **STOPP** und keine produktive Änderung.

## Bereits umgesetzte Entwicklungsleistung

1. **PR #91:** fünf Operationsverfahren inklusive `PRODUCTION_BACKUP_STAGING_GATE.md`, `FREE_POSTGRES_DEADLINE_DECISION.md`, `DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md`, `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` und `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`. Alle dokumentieren offene Freigaben; **kein realer Export oder Restore**.
2. **Offline-Regressionsschutz:** `scripts/test-operator-release-gates.mjs` läuft in `npm run check` und prüft die **27** Pflichtfelder der Evidenzvorlage, **11** Netzwerkprüffelder und **8** Backup-Stop-Voraussetzungen samt Mutationen, zusätzlich Rollen-/ACL- und Strukturabnahme im Restore-Runbook.
3. **Letzter grüner Codecommit von PR #91 vor diesem Dokumentationsupdate:** `ad3db97`, vollständige [GitHub Actions 43736178157](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43736178157) **success**. PR #89 HEAD `23c9fd1` [CI 43631464741](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43631464741) und PR #90 HEAD `53a7ad8` [CI 43708581500](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43708581500) jeweils grün. Alle drei PRs offen, zuletzt konfliktfrei.
4. **Diese Aktualisierung:** Das offene P0-Tracking-[Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) bleibt der Übergabepunkt für echte Betreiberentscheidungen. Die bestehende Backup-Restore-Akzeptanz `scripts/test-pg18-backup-restore.sh` wurde in Commit `ad3db97` um **einen echten synthetischen SQL-Testfall** erweitert: Separate Quelle/Ziel-Datenbanken, zwei zeitlich begrenzte `NOLOGIN`-Rollen, GRANT und geänderter Eigentümer, dump/restore mit `--no-owner --no-acl`. Der Test verifiziert wiederhergestellte Testdaten **bei fehlendem ursprünglichem Eigentümer und SELECT-Recht im Ziel**, räumt alles über Trap auf und verweigert fremde Datenbank-URLs. Vollständige CI dafür **grün** ([43736178157](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43736178157)). Kein echter Render-Dump/Restore.

## Aktuelle technische Verbesserung: CI-Restore nicht-destruktiv vorbereiten (15.11.2026)

| Schwerpunkt | Konkret erledigt | Test / offen |
| --- | --- | --- |
| **P0 – keine vorhandene Testdatenbank zerstören** | `scripts/test-pg18-backup-restore.sh`: feste Restore-Ziel-DB durch eindeutigen Laufnamen ersetzt; **kein vorbereitendes `dropdb --if-exists` mehr**; `cleanup` nur bei im aktuellen Lauf wirklich angelegter DB. Code `8fc4ccb`. | Vollständige [CI 43740524530](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43740524530) **success** |
| **P0 – Rollen- und ACL-Fixtures sicher entfernen** | Zwei eigene `NOLOGIN`-Testrollen nur löschen, wenn dieser Lauf sie erfolgreich erstellt hat; SQL-Probe bleibt synthetisch. Code `6f3554d`. | Neuen HEAD-CI-Nachweis kontrollieren |
| **P0 – falschen Docker/Job-Kontext zurückweisen** | Zusätzlich zur exakten CI-URL werden GitHub-Job/-Repository-Kontext und die `postgres:18`-Service-Konfiguration (`cfs_ci`-DB und -User) geprüft. Code `a46eac7`. Kein Ersatz für echte Authentisierung, aber Schutz vor versehentlichem lokalen Aufruf gegen fremden Container. | Vollständige GitHub-CI auf Code- **und** abschließendem Dokumentations-HEAD prüfen; bei Fehler nur gezielt korrigieren |
| **P0 – reale Backup-/Restore-Nachweise** | Unverändert **GESPERRT**. CI-Proben betreffen ausschließlich synthetische Wegwerf-Daten. | Betreiber entscheidet bis **20.11.**, autorisierte echte Sicherung Ziel **25.11.**, isolierter Restore Ziel **30.11.**, siehe [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) |

**Review-Kriterium:** Ein erfolgreiches `createdb` ist Voraussetzung dafür, dass ein temporäres Testziel bei `cleanup` gelöscht werden darf. Bei Namenskollision muss der Test mit Fehler abbrechen, statt vorbestehende Daten zu entfernen. Vor einem späteren Merge ist weiterhin ausdrückliche Freigabe und nach kombinierter Integration CI auf aktualisiertem `main` notwendig. Keine Live-SQL-, Backup-, Render-, Tarif- oder Deployment-Aktion.

## 15.11.2026 – Restore-Testgrenze mit negativen, datenbankfreien Fällen nachweisen

| Priorität | Ergebnis / Test | Nachweis und nächste Aufgabe |
| --- | --- | --- |
| **P0 – Guard darf keine fremde DB erreichen** | `scripts/test-pg18-backup-refusal.mjs` simuliert 5 unzulässige CI-Konfigurationen: fehlendes Opt-in, abweichende DB-URL, falscher GitHub-Actions-Kontext, Repo und Job. Muss jeweils mit Exitcode **2** ablehnen, **bevor Docker gestartet wird**. | Neuer Testcommit `b745f7d`; vollständigen CI-Lauf für aktuellen Branch kontrollieren. |
| **P0 – Fremder PG18-Container muss vor jedem SQL-Aufruf scheitern** | Ein fake `docker ps/inspect` meldet einen PG18-Container mit falschem `POSTGRES_DB`; Test erwartet Refusal **vor** `docker exec` oder anderen datenbankverändernden Befehlen. Keine reale Docker-/Postgres-Verbindung. | Negativtests fest in `npm run check` integriert (Commit `daad6f0`); bei Fehlschlag gezielt korrigieren. |
| **P0 – Korrekte positive Wegwerf-CI bleibt funktionsfähig** | Bisheriger `scripts/test-pg18-backup-restore.sh` prüft weiterhin synthetische PG18-Daten und ACL-Verlust; letzte vollständig grüne Branch-CI vor dieser Arbeit [43740793960](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43740793960). | **Beide** Tests müssen auf dem neuen HEAD grün sein; ein Negativtest allein ersetzt keine positive Restore-Prüfung. |
| **P0 – reale Daten vor Free-Ablauf sichern** | **GESPERRT**: echte Produktivsicherung, isolierter Restore, Staging-Trennung und Freigaben nicht nachgewiesen. | Bis **20.11.** Betreiberentscheidung, Ziel **25.11.** Sicherung und **30.11.** Restore. [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93). |

Die neue Prüfung ruft ausschließlich eine gefälschte `docker`-Datei aus einem temporären Ordner auf. Sie schützt vor einer versehentlichen Entfernung des CI-Gates, ist aber **keine harte Sicherheitsgrenze gegen absichtlich gefälschte Runner/Env**. Kein SQL, Export, Merge, Render-Change, Deploy oder zusätzliche Kosten. Übergabe: `docs/handover/2026-11-14-backup-staging-gates.md`.

## 15.11.2026 – Verschlüsselten synthetischen Dump bis zum Restore testen

| Priorität | Umsetzung und Abgrenzung | Test und nächster Schritt |
| --- | --- | --- |
| **P0 – Verschlüsselung im CI-Backup nachweisen** | `scripts/test-pg18-backup-restore.sh` nutzt nur synthetische Daten, ephemeres GnuPG/AES-256, einen zufällig erzeugten kurzlebigen 64-stelligen Hex-Schlüssel, SHA-256 der **verschlüsselten** Datei, exakten Decrypt-Vergleich und Restore aus dem entschlüsselten Dump. Passphrase und Testartefakte bleiben im restriktiven temporären CI-Verzeichnis und werden bei Script-Exit entfernt. Code `195528a`, Korrektur `0ee443b`. | **Vollständige CI [43743745850](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43743745850) success.** Erster CI-Lauf `195528a` rot wegen fehlerhaftem Hex-Zeichenfilter; korrigiert. |
| **P0 – produktives Verschlüsselungsverfahren gesondert freigeben** | Synthetische AES-256-GnuPG-CI ist **keine** Entscheidung für Produktionsschlüssel, Speicherung, Entschlüsselungsberechtigte oder datenschutzrechtliche Aufbewahrung. Operator-Runbook und Gate B bleiben **GESPERRT**. | Betreiber bestätigt bis **20.11.** kostenfreie Fortführung, sichere unabhängige Ablage, Key-Management und tatsächliche Exportberechtigung; [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93). |
| **P0 – echter Backup-/Restore-Abnahmenachweis** | Weiterhin **nicht durchgeführt**: echtes verschlüsseltes Produktionsbackup, isolierter Restore, Rechte-/ACL-/Schema-Prüfung und getrennte Staging-DB. | Planungsziel **25.11.** autorisierte Sicherung, **30.11.** isolierter Restore. Keine Ausführung ohne eigene Genehmigung und alle acht Runbook-Vorbedingungen. |
| **P1 – dokumentierte CI-Qualität** | `PRODUCTION_BACKUP_STAGING_GATE.md` und Übergabe unterscheiden synthetischen Verschlüsselungsmechanismus von realer Betreiberabnahme. | Abschluss-CI auf aktuellem Dokumentations-HEAD überprüfen; anschließend #91 nur zum Review bereitstellen, **kein Merge** ohne ausdrückliche Freigabe. |

**Stop-Regel:** Erfolgreiche GnuPG-CI oder valide SHA-256 beweisen keine externe Datensicherung, keine sichere langfristige Schlüsselaufbewahrung und keinen erfolgreichen Restore von Live-Daten. Keine Datenbank-/Render-/Staging-/Deployment-Änderung und keine Kosten. Die weitere operative Umsetzung liegt ausschließlich bei berechtigten Betreibern.

## 15.11.2026 – Negativtests für verschlüsselte Backup-Artefakte

| Priorität | Konkrete Verbesserung | Stand / nächster Nachweis |
| --- | --- | --- |
| **P0 – manipulierte Sicherung zurückweisen** | Separates Kopieren und Verändern des **synthetischen** GnuPG-Ciphertexts: die zuvor erstellte SHA-256-Referenz muss den Inhalt **vor** jeder Entschlüsselung/Restore ablehnen. Das unbeschädigte Artefakt wird weiterhin im positiven Restore-Test verwendet. Code `0c16553`. | Vollständige CI des neuen Codes und anschließend des Dokumentations-HEAD prüfen; kein Erfolg vor CI behaupten. |
| **P0 – falschen Schlüssel zurückweisen** | GnuPG-Entschlüsselung mit bewusst falscher, kurzlebiger CI-Testpassphrase **muss fehlschlagen**. Symmetrischen GnuPG-Schlüsselcache für Verschlüsselung und beide Entschlüsselungen deaktiviert, um falsches Bestehen des Tests zu vermeiden. | Test muss zusammen mit positiver GnuPG-/PG18-Restore-Abnahme und den sechs CI-/Docker-Verweigerungen grün sein. |
| **P0 – richtige Betreiber-Stoppfolge** | `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md` verlangt vor autorisiertem Restore den Vergleich der **verschlüsselten** Sicherung mit dem **getrennt gespeicherten** SHA-256-Wert. Falscher Schlüssel, Manipulation oder ungeklärte Authentizität ⇒ **STOPP**. | Kein echter Datenexport/-restore. Prüfsumme schützt gegen erkennbaren Integritätsfehler, nicht automatisch gegen gleichzeitigen Austausch von Datei und Referenz. |
| **P0 – reale DB vor Ablauf retten** | Unverändert **GESPERRT**; [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) offen. Bestätigter Render-Free-Ablauf **09.12.2026 18:36 UTC**. | Bis **20.11.** Betreiber- und Kostenentscheidung; Ziele **25.11.** autorisierter verschlüsselter Dump und **30.11.** isolierter Restore inkl. Rollen/ACL. |

**Grenze:** Die Negativtests manipulieren ausschließlich synthetische GnuPG-CI-Daten im temporären Verzeichnis, **keine** produktiven Artefakte. Keine Produktion, kein Deployment, kein Merge, keine neuen Render-Ressourcen und keine zusätzlichen Kosten. Übergabe mit Testbefund: `docs/handover/2026-11-14-backup-staging-gates.md`.

## Nächste Entwicklungsrunde

1. **Aktuellen CI-Lauf** nach dieser Übergabe-/Planänderung prüfen; Fehler ausschließlich begründet korrigieren. **Kein** automatisches „grün“, bevor GitHub Actions für den neuen HEAD Erfolg gemeldet hat.
2. Issue #93 dient dem Betreiber als sichtbarem P0-Nachverfolgungspunkt. Erst nach echten externen Nachweisen den Status dort durch Berechtigte ändern; niemals Freigabe-Checkboxen hypothetisch abhaken.
3. PR #91 und die unabhängigen PRs #89/#90 zum **formalen Review** geben. Kein Merge ohne ausdrückliche Genehmigung; danach Gesamt-CI auf aktualisiertem `main`.
4. Keine weitere Mutationstest-Ausweitung ohne neuen Befund. Die nächsten entscheidenden Fortschritte hängen von Berechtigung, tatsächlich kostenloser Fortführungsoption und ausgeführtem realem Backup-/Restore-Beleg ab.

## Grenzen und Rollback

Keine produktive Datenbankabfrage/Schreibaktion, Migration, Geheimnisweitergabe, Datenausleitung, Backup/Restore, Tarifwechsel, Render-Allowlist-Änderung, neue Ressource, Staging-/Produktivdeployment oder Merge ohne ausdrücklich getrennte Berechtigung. Eine grüne CI mit synthetischem PG18 ist **kein Produktionsnachweis**. Der ungemergte PR #91 kann ohne Live-Laufzeitänderung verworfen werden; Änderungen liegen in Operations-Dokumentation, lokalem Dokumentations-Guard und einem ausschließlich mit expliziter Wegwerf-CI-URL zugelassenen synthetischen PostgreSQL-18-Restore-Test. Übergabe: `docs/handover/2026-11-14-backup-staging-gates.md`.
