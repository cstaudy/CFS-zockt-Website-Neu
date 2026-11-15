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
