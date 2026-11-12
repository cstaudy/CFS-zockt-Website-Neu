# Datenbank-Migrationen

Die Migrationen sind für PostgreSQL bei Render vorgesehen.

`001_initial.sql` aktiviert `pgcrypto` selbst:

```sql
create extension if not exists pgcrypto;
```

`npm start` führt bei gesetzter `DATABASE_URL` ausstehende Migrationen automatisch aus. Eine Datenbanksperre verhindert parallele Läufe; `schema_migrations` speichert Name und SHA-256-Prüfsumme. Bereits ausgeführte Dateien werden übersprungen. Eine nachträglich geänderte SQL-Datei stoppt den Start, statt unbemerkt erneut ausgeführt zu werden.

Bei einer bestehenden Datenbank ohne `schema_migrations` darf `npm run migrate:baseline` einmalig verwendet werden. Der Befehl benötigt die ausdrückliche Freigabe `CONFIRM_MIGRATION_BASELINE=yes`. Er führt alle Migrationen zunächst in einer Transaktion aus, vergleicht Tabellen, Spalten, Constraints, Indizes und Erweiterungen davor und danach und rollt den Test vollständig zurück. Nur wenn keine Migration das Schema verändern würde, werden die SHA-256-Prüfsummen registriert. Migrationen mit datenverändernden SQL-Befehlen werden grundsätzlich abgewiesen.

Auf Render kann der einmalige Baseline-Lauf beim Start mit `MIGRATION_BASELINE_ON_START=yes` und `CONFIRM_MIGRATION_BASELINE=yes` aktiviert werden. Ein identischer, bereits registrierter Stand wird sicher übersprungen; abweichende Prüfsummen stoppen den Start. Nach erfolgreicher Übernahme beide Variablen wieder entfernen, damit normale Migrationen über `npm start` laufen.

Vor diesem einmaligen Produktionsschritt weiterhin einen Datenbankexport anlegen. Die Zugangsdaten gehören ausschließlich in Render unter Environment Variables und niemals in GitHub.
