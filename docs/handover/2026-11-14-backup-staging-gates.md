# Übergabe – Backup-/Staging-Gates, 14.11.2026

## Stand
- PR #89: letzter HEAD `23c9fd1`, CI Run `43631464741` erfolgreich, mergeable/clean. **Kein Merge**, da ausdrückliche Freigabe fehlt.
- Neuer unabhängiger Branch `docs/backup-staging-readiness-2026-11-14` von `main`; keine Überschneidung mit PR #89.
- Neue Dokumentation: `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md`. Behandelt Free-DB-Frist 09.12.2026, echte verschlüsselte Sicherung, Restore in isolierte Datenbank, Staging-Trennung, historische Ledger-/Migrationsblocker, Freigaben und Stop-Regeln.
- Keine Render-Konfigurationsänderung, kein DB-Zugriff, kein Dump, keine Migration, kein Deploy, keine Kosten.
- **Nächster Schritt:** CI dieses Dokumentations-PRs prüfen; Betreiber benötigt eine kostenfreie Zielentscheidung und muss den echten Backup-/Restore-Nachweis selbst autorisieren. Danach erst Staging-Plan konkretisieren.

## Rollback
Nur Dokumentationsänderungen; Branch/PR kann ohne Laufzeiteffekt verworfen werden.

## Fortsetzung – kostenfreie Fristentscheidung
- PR #91: HEAD `a72e1a3` CI erfolgreich, Run `43631677494`; PR bleibt Draft und ungemergt.
- Neu: `docs/operations/FREE_POSTGRES_DEADLINE_DECISION.md` (Commit `cd6639c`). Vier Optionen mit Risiken und ausdrücklich offenen Verfügbarkeits-/Kostenfragen, Planungsziele 20./25./30.11. und 04./07.12.2026, Stop-Kriterien sowie nachweisbare, geheimnisfreie Betreiberabnahme.
- Keine Sicherung, Restore, Datenbankabfrage, Render-Änderung oder Freigabe. CI des aktualisierten PR-HEAD erneut prüfen.

## Fortsetzung – prüfbares Betreiberprotokoll
- Neuer Commit `c471908`: `docs/operations/DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md`. Nicht geheime Abnahmevorlage mit getrennten A–D-Gates für Kosten/Berechtigung, verschlüsseltes Backup, isolierten Restore, Staging/Migration. Alle unbestätigten Felder stehen explizit auf OFFEN/NEIN; Gesamtstatus GESPERRT.
- Vorheriger Dokumentationsstand `a72e1a3` grün (Run `43631677494`). Nachfolgende Runs `43632157602` und `43632169812` waren beim Prüfzeitpunkt noch in Bearbeitung. CI des neuen HEAD prüfen.
- Keine Sicherung, kein Restore, keine Produktions- oder Render-Änderung. Die Vorlage ist **kein** Backup-Nachweis.

## Fortsetzung – CI-Regression für Dokumentations-Freigaben
- PR #91 auf HEAD `0bf5cd8` grün (Run `43632235907`), mergeable/clean.
- Neu: `scripts/test-operator-release-gates.mjs` und Aufnahme in `npm run check` (`0016aa3`, `66bff2f`, `309b186`). Test liest nur lokale Markdown-Dateien und erzwingt gesperrte Standardfelder, Frist, Restore-/Staging-Hinweise und Stop-Regeln. Er prüft **keine** tatsächlichen Backups oder Render-Verbindungen.
- CI des neuen HEAD abwarten; bei Fehlern den Dokumentations-/Testvertrag korrigieren. Kein Merge, Deploy, DB-Zugriff oder Tarifwechsel.

## CI-Korrektur nach Fehlbefund
- CI des HEAD `4365e52` fehlgeschlagen (Run `43632478137`), ausschließlich im neuen Dokumentations-Test: Regex erwartete eine Formulierung `kein ... Produktionsdeploy`, während die Dokumentation tatsächlich `Produktivdeploy erst nach allen Gates` schreibt.
- Test auf die reale, eindeutige Stop-Regel korrigiert (Commit `afbffac`); keine Produktivlogik verändert. CI des aktualisierten HEAD abwarten.

## Abschlussreview (14.11.2026)
- Vollständiger PR-HEAD `9319926` erfolgreich in GitHub Actions (Run `43633532666`), mergeable/clean.
- PR-Dateiliste geprüft: ausschließlich drei Operationsdokumente, datierte Übergabe, Entwicklungsplan, neuer lokaler Dokumentations-Regressionstest und dessen Aufnahme in `npm run check`. Keine Migrationsdatei, kein Server-Routing, kein Render-Manifest und keine produktiven Daten verändert.
- Testfehler durch unpassenden Regex wurde mit `afbffac` korrigiert und ist in der vollständigen CI grün. Regressionstest liest nur Markdown und behauptet keinen echten Restore.
- Ergebnis: Dokumentations-/Testpaket fachlich bereit für Review; **kein Merge und keine Betriebsfreigabe**. Nächster Schritt: Betreiber bestätigt kostenfreies DB-Ziel und echten Backup-/Restore-Nachweis; bis dahin Release-Gates gesperrt.

## Fortsetzung – vollständige Freigabezeilen-Prüfung
- PR #91 auf HEAD `dcf1bba` erfolgreich (GitHub Actions, grün) und review-bereit; PR #89 ebenfalls grün, beide ungemergt.
- `scripts/test-operator-release-gates.mjs` prüft jetzt **jede** Betreiber-Nachweiszeile auf OFFEN/NEIN (außer rein informativem Render-Ablaufdatum), verlangt mindestens 20 Felder und testet selbst, dass eine simulierte `JA`-Freigabe für Produktivdeploy einen Fehler auslöst. Commits `11d84dd`, `1c1ab43`.
- Keine echten Freigaben, Sicherungen, DB-Zugriffe oder Deployments; neue CI des erweiterten Tests abwarten.

## Fortsetzung – vollständiger Mutations-Negativtest
- Ausgangsstand `c6f6629` grün (CI Run `43636202088`), PR #91 mergeable/clean und zur Review bereit.
- Neuer Test-Commit `cecdc9b`: für **jede** Nachweiszeile wird im Speicher eine simulierte `JA`-Freigabe eingefügt; der Dokumentations-Guard muss jede einzelne zurückweisen. Kein Schreiben an Vorlage, keine DB-/Render-Verbindung.
- CI des neuen HEAD prüfen; weiterhin kein Merge, Deploy oder Betreiberfreigabe.

## Fortsetzung – Pflichtfeld-Vollständigkeit
- Ausgangsstand `b33a8ed` grün (CI `43636469792`), PR #91 mergeable/clean.
- Der Dokumentations-Guard hält nun die 26 Pflicht-Nachweislabels explizit fest, prüft Anzahl und Reihenfolge und simuliert für **jede** Zeile eine Entfernung, die zurückgewiesen werden muss. Commits `8978ab2`, `74fba85`.
- Kein produktiver Zugriff; neue CI prüfen. Eine beabsichtigte Änderung des Abnahmeformulars benötigt bewusste Aktualisierung des Testvertrags und Review.

## Review-Abschluss: Nachweisvertrag stabil
- HEAD `313d440`: GitHub Actions Run `43638290828` **success**, PR #91 **clean**, Review geöffnet, **nicht gemergt**.
- Testvertrag deckt 26 Pflichtnachweise ab, verhindert unbelegte `JA`-Defaults und simuliert pro Feld sowohl unberechtigte Zustimmung als auch Löschung. Alle CI-Prüfungen grün.
- **Stopp für zusätzliche Teständerungen ohne neuen Fehlerbefund**: weitere reine Testchurn vermeiden. PR #91 wartet auf Review-/Mergeentscheidung, PR #89 ebenfalls auf ausdrückliche Mergefreigabe.
- Für echten Betrieb offen: Betreiberentscheidung zu kostenfreiem PostgreSQL-Ziel bis 09.12.2026, autorisierter verschlüsselter Produktiv-Dump, isolierter Restore, nachgewiesene Staging-Trennung und separate Migrations-/Deploymentfreigaben. Keine dieser Arbeiten wurde durchgeführt.

## 15.11.2026 – Read-only Render-Audit: freier DB-Ablauf und breite IPv4-Freigabe
- Live-Metadaten der **bestehenden** Render-DB `cfs-zockt-db` über `get_postgres` ausschließlich gelesen: Status `available`, PostgreSQL `18`, Free, `expiresAt=2026-12-09T18:36:16.141826Z`. Der Datenbank-`ipAllowList`-Eintrag ist `0.0.0.0/0` (`everywhere`). Die Netzwerkfreigabe ist weit, **nicht** gleichbedeutend mit Passwortfreiheit oder Datenzugriff.
- Produktions- und Staging-Webservice-Metadaten read-only geprüft: beide Auto-Deploy `off`, Branchen `main` beziehungsweise `codex/render-hardening`. Eine unabhängige Staging-Datenbank ist damit **nicht** nachgewiesen.
- Neuer operativer Gate A2 in `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md`: Berechtigte Clients ermitteln, interne/externe Render-Verbindungswege und Rollback prüfen, Allowlist nur nach separater Betreiberfreigabe ändern. Sofortige Änderung ohne Reichweitenprüfung wäre ausfallgefährdend.
- `docs/operations/FREE_POSTGRES_DEADLINE_DECISION.md`: konkretes UTC-Ablaufdatum und Netzwerkrisiko bis Betreibermeilenstein **20.11.2026** einplanen.
- `docs/operations/DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md`: neues Pflichtfeld „DB-Netzwerkzugang und erforderliche Client-Ausnahmen geprüft?“ mit `NEIN – nicht nachgewiesen`; weiterhin **Gesamtstatus GESPERRT**.
- `scripts/test-operator-release-gates.mjs`: Dokumentationsvertrag wächst von **26 auf 27 Pflichtfelder**, inklusive `JA`- und Zeilenlösch-Mutationstests für das neue Feld. Dokumententest ist **kein** realer Netzwerk-/Backup-/Restore-Nachweis.
- Vor Beginn dieser Änderungen war PR #91 auf HEAD `0f4d4f7`, CI [43638415138](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43638415138) **success**, mergeable/clean. **CI dieser Änderungen noch prüfen.** Keine Render-Einstellung geändert, keine SQL-Query, kein Backup, kein Deploy, keine zusätzlichen Kosten.
- Kein selbstständiger Merge; Produktionsfreigabe bis zu Betreiberentscheidung, echtem Backup/Restore, isoliertem Staging und separater Genehmigung weiter gesperrt.

## 15.11.2026 – Gate A2 in Statusübersicht und CI fest verankert

- **Vorheriger Branch-HEAD `7761e78`:** vollständig grün, [CI 43709000473](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43709000473), PR #91 review-bereit und mergeable/clean. Die bestehende 27-Felder-Vorlage blieb gesperrt.
- `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md`: Gate **A2 – DB-Netzwerkzugang** jetzt auch ausdrücklich in der operativen Freigabetabelle mit Status **Offen** und erforderlichem Nachweis (benötigte DB-Clients, sichere Änderung und Rückweg). Dokumentationscommit `aeb82aa` grün in [CI 43709288536](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43709288536).
- `scripts/test-operator-release-gates.mjs`: eigenständiger Validator schützt die A2-Sektion gegen Löschung, verlangt die dokumentierte `0.0.0.0/0`-Risikolage, getrennte HTTP-/DB-Pfade, nötige Verbindungen, Rückweg und ausdrückliche Betreiberfreigabe. Er verlangt **Offen** in der Tabelle; negative Mutationstests entfernen A2, entfernen den Risikohinweis oder stellen den Tabellenstatus auf **Bestanden**.
- **CI-Zwischenstand:** Die erste Testerweiterung `e8b87d0` war rot ([43709331022](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43709331022)); Regex-Escapes wurden in `4b46d01` korrigiert. `f1b8d9b` stellt sicher, dass die Mutation gezielt den Abschnitt A2 und nicht nur die vorherige Übersichtszeile ändert. **Finale CI für diese Testkorrekturen und Dokumentations-HEAD noch prüfen; kein Grün vorwegnehmen.**
- Die Tests lesen ausschließlich Repo-Markdown; die echte Render-Allowlist blieb unverändert. Auch **Gesamtstatus GESPERRT** bleibt unverändert. Keine DB-Abfrage, keine Migration, kein Backup/Restore und kein Deployment.

## 15.11.2026 – Konkrete Betreiber-Checkliste für sichere DB-Allowlist-Prüfung

- Vorheriger vollständiger PR-HEAD `6b9f2da`: GitHub Actions [43709457507](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43709457507) **success**, PR #91 offen, review-bereit, mergeable/clean. Es liegt weiterhin kein formales Review oder eine Mergefreigabe vor.
- **Neu:** `docs/operations/DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` (Commit `659084c`; CI [43709699102](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43709699102) **success**). Konkrete, aber **nicht ausgeführte** Betreiber-Vorbereitung: notwendige DB-Clients und interne/externe Wege nach Funktion inventarisieren, Backup- und Notfallzugang erhalten, Änderungen nur nach ausdrücklicher Freigabe, Verbindungschecks und Rückweg dokumentieren. 11 Nachweis-/Entscheidungszeilen beginnen als `OFFEN` oder `NEIN`, Gesamtstatus **GESPERRT**. Keine realen IP-Adressen, DB-URLs oder Secrets veröffentlichen.
- `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md` verlinkt die Checkliste unmittelbar unter Gate A2 (Commit `ec649e6`).
- `scripts/test-operator-release-gates.mjs` (Commit `2dc7971`): liest die Checkliste ebenfalls **offline**, verlangt `GESPERRT`, bekannten `0.0.0.0/0`-Befund, Betreibertermin 20.11.2026, Rückweg und 11 standardmäßig abgelehnte Nachweis-/Entscheidungszeilen; eine simulierte unberechtigte `JA`-Freigabe muss fehlschlagen. **Neue CI noch offen**, keine Freigabe vor grünem aktuellem HEAD.
- Keine Netzwerk-/Render-Änderung, kein SQL, kein echter Dump oder Restore, keine Ausweitung auf neue DB-Ressourcen und keine Kosten. Fortsetzung hängt von Operatorentscheidung, realen Backup-/Restore- und Staging-Nachweisen ab.

## 15.11.2026 – Checkliste gegen unbemerkte Freigaben und Pflichtfeldverlust abgesichert

- Vorheriger vollständiger Branch-HEAD `3e56bd4`: GitHub Actions [43709827298](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43709827298) **success**, PR #91 offen und ohne gemeldeten Merge-Konflikt.
- Neuer Testcommit `6a29cf1` in `scripts/test-operator-release-gates.mjs`: Die 11 Felder der `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` werden nun einzeln mit **exaktem Label und Reihenfolge** verglichen, nicht nur über ihre Anzahl. Für **jedes** Feld werden eine simulierte, unerlaubte `JA`-Freigabe und eine simulierte Entfernung zurückgewiesen; die Checkliste bleibt dabei unverändert.
- Querverweis zwischen Gate A2 und dem Operator-Runbook wird jetzt in beiden Richtungen überprüft. Alle 27 Felder des Produktionsbackup-/Restore-Protokolls und ihr Mutationsschutz bleiben unangetastet. `Gesamtstatus: GESPERRT` ist weiterhin bindend.
- Die Erweiterung ist ein ausschließlich lokaler, kostenfreier Dokumentationsregressionstest; **keine tatsächliche Datenbank-/Allowlist-Prüfung**, kein Restore, kein Datenexport und keine Freigabe. CI auf dem neuen Test- und späteren Dokumentations-HEAD prüfen; erst nach Erfolg als grün kennzeichnen.

## 15.11.2026 – Herstellerprüfung: Free-DB-Ablauf und Datenrettung präzisiert

- Ausgehend von PR #91 HEAD `8cfbd40`: [CI 43710490563](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43710490563) **success**, PR weiterhin offen, mergeable/clean, ohne formale Review-/Mergefreigabe.
- Offizielle **aktuelle Render-Dokumentation**, am 15.11.2026 geprüft:
  - [Render Free](https://render.com/docs/free): Free-Postgres **30 Tage**, danach **unzugänglich**; **14-tägige Nachfrist ausschließlich für Upgrade auf Paid**, anschließend Löschung; maximal **eine gleichzeitig aktive Free-DB je Workspace**. Damit ist der bloß vermutete gleichzeitige Free-Staging-Ersatz auf Render **keine bestätigte Option**.
  - [Render Backups](https://render.com/docs/postgresql-backups): Free-Postgres hat **keine automatischen logischen Exporte/PITR**. Ein autorisierter Betreiber kann während der Laufzeit **vom eigenen Client per `pg_dump`** exportieren, anschließend getrennt verschlüsseln und einen isolierten Restore nachweisen. Weder Dump noch Restore wurden ausgeführt.
  - [Render DB-Verbindungen](https://render.com/docs/postgresql-creating-connecting): DB-Allowlist `0.0.0.0/0` betrifft **externe** DB-Verbindungen. Die interne Datenbank-URL für Render-Dienste im selben Workspace und derselben Region unterliegt dieser Allowlist nicht. **Welche URL-Klasse die echte Anwendung nutzt, ist nicht geprüft**.
- Diese Herstellerbedingungen und die daraus folgende Priorität **Backup vor Free-Ablauf** sind in `docs/operations/FREE_POSTGRES_DEADLINE_DECISION.md`, `PRODUCTION_BACKUP_STAGING_GATE.md` und `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` dokumentiert. Option A (reguläre kostenlose Render-Verlängerung) ist jetzt ausdrücklich **nicht nachgewiesen**; keine kostenlose Fortführung oder Wiederherstellung unterstellt.
- Planungsfristen bleiben **20.11. Betreiberentscheidung**, **25.11. autorisierter verschlüsselter Dump**, **30.11. isolierter Restore**, spätestens **09.12.2026 18:36 UTC** Datenbankablauf. Diese Fristen sind Ziele, keine automatisch erzeugten Erinnerungen oder Betreiberzusagen.
- Keine Tests oder Serverlogik geändert; CI auf dem **neuen Dokumentations-HEAD** muss nachgeprüft werden. **Keine** Änderung an Render, SQL, Backup, Restore, Tarif, Migration, Deployment oder Merge. Gesamtstatus bleibt **GESPERRT**.

## 15.11.2026 – Betreiber-Runbook: Echter verschlüsselter Backup-/Restore-Nachweis vorbereitet

- **Ausgangslage:** Alle drei PRs #89/#90/#91 offen, review-bereit und GitHub mergeable/clean. Letzter bestätigter grüner PR-#91-HEAD `2b232c3`, [CI 43711926120](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43711926120) **success**.
- Bestehenden isolierten Test `scripts/test-pg18-backup-restore.sh` und `scripts/test-legacy-dump-restore-upgrade-pg18.mjs` gelesen: Die Verfahren nutzen nur synthetische PostgreSQL-18-CI-Daten, sind **kein** Produktivbackup, kein Restore-Nachweis für Render und dürfen nicht gegen Live-Daten ausgeführt werden.
- Neues **Operator-only-Runbook** `docs/operations/PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md` (Commit `8248b19`): Einleitend **GESAMTSTATUS GESPERRT**, acht einzelne vorab zu erfüllende **OFFEN**-Vorbedingungen, Ablauf für autorisierten Dump in restriktivem temporärem Speicher, getrennte Verschlüsselung/externen Speicher, SHA-256 des **verschlüsselten** Artefakts, Restore ausschließlich in verifizierte **leere Wegwerf-DB**, Schema-/Zählwert-/Fingerprint-Nachweis und klare Stop-/Rollback-Regeln. Kein automatisches Starten von Migrationen oder vertrauliche Daten in GitHub/CI.
- Operatives Gate C in `PRODUCTION_BACKUP_STAGING_GATE.md` verweist auf das neue Runbook (Commit `ad114a8`). Die bestehende Backup-/Restore-Evidenzvorlage mit **27 OFFEN/NEIN-Pflichtfeldern** bleibt unverändert und gesperrt.
- Offline-Dokumentationsguard in `scripts/test-operator-release-gates.mjs` (Commits `21718d0` und `31d62b3`) verlangt die acht **exakten** Vorbedingungslabels mit Status **OFFEN**, Verschlüsselungs-/Restore-Hinweise, Free-Ablaufdatum und Link in Gate C. Simulierte unbelegte `JA`-Freigabe und Löschung **jedes** Vorbedingungsfelds müssen den Guard scheitern lassen. Ausschließlich Repo-Dateizugriff, **keine** Live-DB-Verbindung.
- **CI für neue Commits/abschließenden HEAD noch nachweisen.** Keine echte Verschlüsselung, Sicherung, Restore, DB-Migration, Render-Änderung, Kosten, Merge oder Deploy. Fristziele **20.11. Betreiberentscheidung**, **25.11. autorisierter Dump**, **30.11. isolierter Restore**; tatsächlicher Render-Free-Ablauf **09.12.2026 18:36 UTC**.

## 15.11.2026 – Restaurierte Daten ≠ funktionsfähige Rollen und Berechtigungen

- Ausgangs-HEAD `3dffb4c`: vollständige CI **success**, [43716436257](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43716436257). PRs #89, #90, #91 bleiben offen, ready-for-review und GitHub `mergeable_state=clean`; keine Zusammenführung.
- **Konkreter Prüfungsbefund** aus [PostgreSQL 18 pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) und [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html): Der im Runbook vorgesehene Restore mit `--no-owner --no-acl` überträgt ursprüngliche Eigentümer und `GRANT`-/`REVOKE`-Rechte nicht; ein einzelner DB-Dump enthält keine globalen Rollen. Ein erfolgreicher Restore-Exitcode oder Tabellen-/Daten-Fingerprint ist somit **kein Nachweis**, dass Anwendung und Rechte danach funktionieren.
- `docs/operations/PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md` (Commits `a9b8f64`, `c1bb7cf`) verlangt jetzt vor jeder Betriebsabnahme separat geprüfte Zielrollen und Minimalrechte, Constraints, Trigger, Indizes, Sequenzen, Erweiterungen und Funktionen sowie – nur nach eigener Autorisierung – einen isolierten read-only Probezugang mit dedizierter Testrolle, ohne produktive Clients/Integrationen und ohne automatische Migrationen.
- Gate C in `PRODUCTION_BACKUP_STAGING_GATE.md` (Commit `69d913e`) verschärft: Ein syntaktisch erfolgreicher Restore allein darf das Gate **nicht** auf bestanden setzen. `scripts/test-operator-release-gates.mjs` (Commit `4092c72`) prüft die zusätzliche Dokumentations-Sperre. Test-HEAD-CI **noch prüfen**; vorherige Runbook-/Gate-Commits waren bereits grün.
- **Keine Datenbankaktion, kein echter Restore, keine Produktionsfreigabe**. Das vorhandene 27-Felder-Protokoll und die 8 Backup-Stop-Bedingungen bleiben gesperrt. Spätere Betreiberabnahme braucht tatsächliche, separat autorisierte Belege; CI allein genügt nicht.
