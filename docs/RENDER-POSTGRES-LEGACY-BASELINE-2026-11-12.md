# Render-PostgreSQL: Legacy-Baseline und MFA-Upgrade (kein automatischer Rollout)

**Status: Technische Vorbereitung, nicht auf Produktion ausgeführt.** Die kostenlose Render-Postgres-Instanz hat laut bisheriger Bestandsaufnahme ein angekündigtes Ablaufdatum am **9. Dezember 2026, 18:36 UTC**. Ein vollständiger, extern sicher gespeicherter und auf einer isolierten Datenbank erfolgreich wiederhergestellter PostgreSQL-18-`pg_dump` ist **noch nicht bestätigt**.

## Zwingende Stopps vor jeder Datenbankschreiboperation

1. **Getrennte Freigabe für die produktive Datenbank** einholen. Keine automatische Freigabe durch einen GitHub-Merge oder bestandene CI.
2. Tatsächliche PG18-Datensicherung erstellen, sicher außerhalb der ablaufenden Instanz aufbewahren, Integrität prüfen und **auf einer isolierten Testdatenbank vollständig restaurieren**, inklusive Tabellen, Konten und relevanter Inhalte. Ein Source-ZIP ersetzt niemals `pg_dump`.
3. Reines **Read-only-Inventar** des produktiven Schemas und der Migrationshistorie erstellen. Die frühere Bestandsaufnahme meldete 26 Tabellen und keine `schema_migrations`. Diese Beobachtung vor dem Eingriff erneut bestätigen.
4. Bestehendes Admin-Konto und dessen Berechtigungen bestätigen, bevor neue Authentifizierungs-/Admin-Regeln deployt werden. PR #26 ist eine gesonderte Freigabe und darf nicht still aktiviert werden.
5. Einen **separaten, isolierten Restore-Klon** für den folgenden Ablauf verwenden. Fehlende Tabellen, Schemaabweichungen oder Migrationsfehler bedeuten **Stopp und Untersuchung**, nicht manuelles Überbrücken.

## Zwei strikt getrennte Schritte (nur auf dem Restore-Klon zuerst)

### A. Historische Baseline – nur 001 bis 021

Der **manuelle** Befehl `npm run migrate:baseline` hat nun eine feste Liste von **genau 21 historischen Migrationen** (`001_initial.sql` bis `021_creator_settings.sql`). Er benötigt alle drei bewusst gesetzten Variablen:

```sh
CONFIRM_MIGRATION_BASELINE=yes \
CONFIRM_VERIFIED_DATABASE_BACKUP=yes \
CONFIRM_LEGACY_BASELINE_ONLY=yes \
npm run migrate:baseline
```

Die Bestätigungsvariablen sind eine **Sperre, keine automatische Prüfung**, ob wirklich ein Backup existiert. Sie dürfen nur nach tatsächlicher Sicherung, erfolgreichem Restore und gesonderter Berechtigung gesetzt werden.

Der vorhandene Baseline-Runner prüft durch eine **zurückgerollte Schema-Probe** die Gleichheit des Bestands mit den historischen Migrationsdateien. Jede Schemaänderung führt zum Abbruch. Erst bei identischem Schema zeichnet er die 21 Checksummen in `schema_migrations` auf. **Migrationen 022 bis 025 dürfen hier niemals als schon ausgeführt markiert werden.**

### B. Neue Migrationen – 022 bis 025

**Erst nach erfolgreicher historischer Baseline**, Schema-Inventar und ausdrücklich separater Migrationsfreigabe darf `npm run migrate` auf dem Restore-Klon laufen. Der reguläre Runner überspringt dann die 21 historischen Prüfsummen und führt ausschließlich die ausstehenden Migrationen 022–025 aus. Anschließend Tabellen, Spalten, MFA-Login, Login-Sessions und Creator-Regressionen auf dem Klon testen.

Erst nach bestandener Klon-Abnahme den produktiven Rollout gesondert planen, mit Backup, klarer Downtime-/Rollback-Strategie und expliziter Berechtigung. **Keine Autodeploys oder kostenpflichtigen Render-Upgrades.**

## Technische Sperren

- `MIGRATION_BASELINE_ON_START=yes` führt jetzt absichtlich zum **Startfehler** statt zur Änderung einer Bestandsdatenbank. Die historische Baseline ist nur als bewusster Einzelbefehl zulässig.
- Startet der normale Migrationsrunner auf einer Bestandsdatenbank ohne `schema_migrations`, bricht er **vor dem Erstellen oder Ändern** von Anwendungstabellen ab.
- Das sind zusätzliche Schutzmaßnahmen, **kein Ersatz für echtes Backup, isolierten Restore, Rechteprüfung oder manuelle Freigabe**.
