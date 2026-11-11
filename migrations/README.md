# Datenbank-Migrationen

Die Migrationen sind für PostgreSQL bei Render vorgesehen.

`001_initial.sql` aktiviert `pgcrypto` selbst:

```sql
create extension if not exists pgcrypto;
```

`npm start` führt bei gesetzter `DATABASE_URL` ausstehende Migrationen automatisch aus. Eine Datenbanksperre verhindert parallele Läufe; `schema_migrations` speichert Name und SHA-256-Prüfsumme. Bereits ausgeführte Dateien werden übersprungen. Eine nachträglich geänderte SQL-Datei stoppt den Start, statt unbemerkt erneut ausgeführt zu werden.

Bei einer bestehenden Datenbank ohne `schema_migrations` werden die vorhandenen, idempotent angelegten Migrationen einmal erneut geprüft und danach vermerkt. Vor dem ersten Deploy gegen produktive Daten eine Datenbanksicherung und einen Testlauf gegen eine Kopie durchführen. Die Zugangsdaten gehören ausschließlich in Render unter Environment Variables und niemals in GitHub.
