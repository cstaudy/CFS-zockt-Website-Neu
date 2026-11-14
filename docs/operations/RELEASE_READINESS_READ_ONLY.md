# Release-Preflight: Nur-Lesen, Datenbank- und Staging-Gates

Stand: 14.11.2026. Dieses Prüfwerkzeug ist **keine Freigabe für einen Deploy**.
Weder die statischen CI-Tests noch ein erfolgreicher Preflight ersetzen
einen verifizierten Produktiv-Backup/Restore, einen separaten Staging-Datenbanknachweis
oder die Betreiberentscheidung.

## Verwendung (durch autorisierte Betreiber)

`npm run release:preflight` startet ausschließlich
`scripts/check-release-readiness.mjs`. Der Befehl **verweigert** die
Ausführung ohne `CONFIRM_RELEASE_PREFLIGHT_READ_ONLY=yes` und eine
bereits sicher konfigurierte `DATABASE_URL`. Die Verbindungsdaten dürfen
nicht in Tickets, CI-Artefakte oder Terminal-Logs kopiert werden.

Der Check öffnet `BEGIN TRANSACTION READ ONLY`, liest nur
PostgreSQL-Systemkataloge sowie Namen und SHA-256-Prüfsummen aus
`schema_migrations`, führt `ROLLBACK` aus und beendet die Verbindung.
Keine Konto-IDs, E-Mail-Adressen, personenbezogenen Daten,
Zugriffstokens oder Tabellendatensätze werden ausgegeben. Es werden **keine**
Migrationen, Schemaänderungen, Baselines, Backups oder Deployments gestartet.

Ausgabe: JSON mit `migration_history`, `pending_migration_files`,
`checksum_mismatch_files`, neutralen Schema-Flags und `blockers`.
**Exitcode 2** bedeutet, dass die Datenbank nicht für einen *migrationsfreien*
Start des aktuellen Builds bereit ist. Selbst bei Exitcode 0 bleibt
`production_release_approved:false`, da externe Abnahmekriterien nicht
von einem reinen Datenbankcheck nachgewiesen werden können. Bereits
vorhandene, aber unbekannte Migrationen und Prüfsummenkonflikte
blockieren. Der Check macht keine automatische Änderung.

Der CI-Workflow verwendet den Check erst **nach** der Erstellung und
Migration seiner vollständig isolierten, flüchtigen PostgreSQL-18-
Testdatenbank. Die zusätzlichen Unit-Tests simulieren eine unvollständige
Legacy-DB, leere oder widersprüchliche Historien und den
Berechtigungs-/Konfigurationsschutz. CI ist kein Produktivbackup.

## Zusätzlicher Legacy-Schemaform-Abgleich (Migrationen 001–021)

Solange die historische Datenbank zwar Anwendungstabellen, aber noch
**keine** `schema_migrations`-Historie besitzt, führt der Preflight eine
zweite, ausschließlich lesende `information_schema.columns`-Abfrage aus.
Die **erwarteten 26 historischen Tabellen und Spalten** werden aus den
vorhandenen Migrationsdateien 001–021 abgeleitet – nicht aus einem
abgeschriebenen Live-Schema.

Für jede Spalte werden Name, PostgreSQL-Typ und `NULL`-Zulässigkeit
verglichen. Fehlende, zusätzliche und inkompatible Tabellen/Spalten
werden ohne Tabelleninhalte als `legacy_schema_shape` gemeldet.
Abweichungen setzen `LEGACY_SCHEMA_SHAPE_DRIFT`. Damit kann eine
vermeintlich harmlose Baseline nicht durch einen oberflächlichen
„Tabellen sind vorhanden“-Check legitimiert werden.

**Die Übereinstimmung ist ausdrücklich nur ein Strukturindikator,
kein vollständiger Gleichwertigkeitsbeweis.** Indexe, CHECK-/Fremdschlüssel-
Constraints, Trigger, Funktionen, historische Daten und reale
Backup-Wiederherstellung sind damit **nicht** überprüft. Vor einer
produktiven Baseline gilt weiterhin: Ein autorisierter Betreiber muss
einen **echten** Dump nachweislich in eine **isolierte** Kopie
wiederherstellen, die dortige Baseline-Transaktion samt
vollständigem Metadaten-Fingerprint prüfen und den 022–025-MFA-
Upgrade/Restore-Prozess abnehmen. Dieser PR führt diese Schritte
nicht gegen Render aus.

Die PostgreSQL-18-CI vergleicht den aus echten 001–021-Migrationen
erzeugten Wegwerf-Legacystand mit dem abgeleiteten Vertrag und
überprüft, dass das Entfernen einer historischen Tabelle sofort
als Abweichung erkannt wird.

## Read-only Befund aus der Render-Instanz, 14.11.2026

Für `cfs-zockt-db` wurde über die verbundene Render-Read-only-Abfrage
festgestellt:

- `accounts` und ältere Anwendungstabellen sind vorhanden.
- `schema_migrations` ist **nicht vorhanden**.
- Tabelle `mfa_login_challenges` (022) fehlt, und die
  `account_mfa`-Spalten aus 023, 024 und 025 fehlen.
- `tool_jobs.claimed_by_device` (026) und
  `twitch_follow_subscriptions`/`twitch_follow_events` (027)
  sind noch nicht vorhanden.
- Die Datenbank hat Render-PostgreSQL-18 und einen Free-Plan,
  dessen Konsole den **09.12.2026** als Ablaufdatum meldet.

Damit kann ein normaler aktueller Webserverstart, der bei gesetzter
`DATABASE_URL` zuerst `scripts/migrate.js` ausführt, **nicht**
als Migrationsfreigabe gelten. Der vorhandene
`assertMigrationHistorySafe`-Guard verweigert die automatische
Migration einer bestehenden Datenbank ohne Historie.

## Betriebsreihenfolge vor einem echten Rollout

1. Datenbankablauf/Weiterbetrieb klären. Eigentümer, Zielsystem und
   Berechtigungen festhalten; Speicherorte und Secrets nicht veröffentlichen.
2. **Echtes Backup und erfolgreiche Wiederherstellung in einer isolierten
   Datenbank nachweisen.** Diese Prüfung führt keine der beiden Aktionen aus.
3. Nur bei bestätigter historischer Schema-Gleichwertigkeit und
   Betreiberfreigabe die **001–021**-Baseline nach
   `scripts/baseline-migrations.js` vornehmen. Niemals 022–025 als
   bereits durchgeführt markieren, wenn ihre Tabellen/Spalten fehlen.
4. Migrationen **022–025** erst mit geprüfter Restore-/Rollback-Prozedur
   und Admin-/MFA-Zugangsabnahme anwenden. Anschließend Preflight erneut
   ausschließlich lesend ausführen.
5. Staging-Dienst auf einen freigegebenen Code-Stand bringen, **erst
   nachdem eine eigene Staging-Datenbank unabhängig von Produktion
   nachgewiesen wurde**. Der derzeitige Render-Staging-Branch
   `codex/render-hardening` ist nicht automatisch der neueste `main`.
6. Realen Browser-/OBS-/Launcher-/Creator-/Admin-Abnahmetest und einen
   protokollierten Rollback mit Freigabe durchführen.
7. Erst dann ein separates produktives Deployment entscheiden.
   Migration **026** (exakter Geräte-Claim), **027**
   (Twitch-Follow EventSub), Maker-Shop und Adminrollen-Draft #52
   bleiben **eigenständig** freigabepflichtig.

Bekannte Render-Einstellungen zum Prüfzeitpunkt: Auto-Deploy bei
`CFS-TikTok-Backend` und `cfs-zockt-staging` deaktiviert,
zuletzt live gemeldete Commits `3f8c46e` bzw. `0c5a0ea`.
Keine Änderungen an Konfiguration oder Diensten durch dieses Paket.

**Die Read-only-Prüfung ist bewusst konservativ:** Sie kontrolliert
Ledger/Schema, aber nicht tatsächliche Backups, Wiederherstellbarkeit,
Staging-Trennung, MFA-Login, Providerberechtigungen, Device-Bindung
oder den Produktionsrollout. Kein Check darf diese externen Punkte
implizit als erfüllt melden.
