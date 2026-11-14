# Entwicklungsplan – Upload-Auslieferung und sichere Releases

Stand: 14.11.2026. Kostenrahmen: nur bestehende GitHub-Actions-CI, keine neue kostenpflichtige Render-Datenbank.

| Priorität | Aufgabe | Status / Nachweis |
| --- | --- | --- |
| P0 | Upload-Auslieferung: `nosniff` für alle Dateiendungen | Implementiert auf diesem Branch, CI für HEAD noch prüfen |
| P0 | Creator-Quota-Eingaben absichern | PR #89, CI grün, Draft nicht gemerged |
| P0 | Produktions-Backup und isolierten Restore nachweisen | Blockiert, kein echtes Backup bestätigt |
| P0 | PostgreSQL-Migrationshistorie/Legacy-Baseline klären | Produktions-DB ohne Ledger, keine Schreibzugriffe freigegeben |
| P1 | Upload-Header in realen Browsern und bei Altdateien prüfen | Offen; Unit-Test ersetzt Browserprüfung nicht |
| P1 | Isolierte PostgreSQL-18-Migrationstests in GitHub Actions weiterführen | Vorhandene CI, bei jedem PR erneut prüfen |
| P2 | Render-Staging nur mit unabhängiger DB | Blockiert: zweite kostenlose Render-DB abgelehnt |

## Vorgehen und Rollback
Nach jedem Code-Update Übergabe + Entwicklungsplan im selben Branch, CI des letzten HEAD prüfen, nur nach Review mergen. Keine Produktionsmigration, kein Render-Deploy, kein zusätzlicher Tarif. Bei Browserregression den kleinen Header-Commit revertieren. Als nächste Aufgabe die tatsächliche Header-Anwendung in der HTTP-Auslieferung und den Testumfang prüfen.
