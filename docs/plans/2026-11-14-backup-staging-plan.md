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
