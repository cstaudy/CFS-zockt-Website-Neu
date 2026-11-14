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
