# Produktiv-Deploy: Datenbanksicherung und einmalige Migrations-Baseline

Stand der schreibgeschützten Bestandsaufnahme: **12. November 2026**.

## Aktueller Zustand (nicht als Backup verstehen)

- Render-Datenbank: `cfs-zockt-db`, PostgreSQL 18, **Free**; laut Render Ablauf am **9. Dezember 2026**.
- Auf der bestehenden Datenbank wurden 26 öffentliche Tabellen und ca. 9 MB Gesamtgröße gezählt; Konten, Sessions und Spieledaten sind bereits vorhanden.
- Die neue Tabelle `public.schema_migrations` existiert noch **nicht**.
- Produktiv-Webservice: `CFS-TikTok-Backend`, Branch `main`, **Auto-Deploy aus**. Der zuletzt bestätigte Live-Deploy nutzt noch Commit `3f8c46e`, nicht den PR-20-Merge `3d0548a`.
- Staging läuft auf `codex/render-hardening`, ebenfalls ohne Auto-Deploy, und hat **keine** angeschlossene PostgreSQL-Datenbank. Dort wurden nur Start/HTTP-Verhalten, nicht die Produktivmigration, geprüft.
- **Es liegt bisher kein nachgewiesenes, wiederherstellbares Backup vor.** Das Read-only-SQL-Tool kann ein `pg_dump`-Archiv nicht ersetzen.

## Verbindliche Stop-Bedingung

**Kein Produktiv-Deploy, keine Migration, kein einmaliger Baseline-Modus ohne bestätigtes Backup.**

Render unterstützt auf dem Free-PostgreSQL-Tarif keine verwalteten Backups. Möglichkeiten:
1. Auf einem vertrauenswürdigen Rechner `pg_dump` mit der **externen** Render-Datenbank-URL durchführen.
2. Den Render-Postgres-Tarif **nur nach ausdrücklicher Kostenfreigabe** upgraden und im Render-Dashboard unter `Recovery` einen logischen Export anstoßen.

Offizielle Anleitung: https://render.com/docs/postgresql-backups

## Backup erstellen und prüfen (außerhalb von Chat/GitHub)

1. PostgreSQL-18-Clienttools (`pg_dump`, `pg_restore`) installieren.
2. Die **externe** URL aus `Render > cfs-zockt-db > Connect` geschützt in eine lokale Umgebungsvariable `RENDER_EXTERNAL_DATABASE_URL` übernehmen. Niemals in GitHub, Chat, Screenshots, Shell-Historie oder Logs veröffentlichen.
3. Lokal, in einer vertrauenswürdigen Shell, mit gesetzter Variable ausführen:

```sh
PGSSLMODE=require pg_dump \
  --dbname="$RENDER_EXTERNAL_DATABASE_URL" \
  --format=custom --no-owner --no-acl \
  --file="cfs-zockt-pre-baseline.dump"

pg_restore --list "cfs-zockt-pre-baseline.dump" > "cfs-zockt-backup-inhalt.txt"
```

4. Dateigröße und plausiblen Inhaltsindex prüfen; die Dump-Datei verschlüsselt und getrennt von GitHub aufbewahren.
5. **Wiederherstellung in einer isolierten, leeren Testdatenbank erproben.** Nur ein erfolgreicher Restore gilt als wirklich verifizierte Sicherung. Nicht in die Produktionsdatenbank zurückspielen.

## Nach Backup-Nachweis: kontrollierte Produktivabnahme

1. Prüfen, dass `main` den freigegebenen Code enthält und der Produktivdienst weiterhin Auto-Deploy **aus** hat.
2. Für den **einmaligen** Start mit dem neuen Commit `MIGRATION_BASELINE_ON_START=yes` **und** `CONFIRM_MIGRATION_BASELINE=yes` setzen. Achtung: Änderungen der Render-Environment-Variablen können selbst ein Deployment auslösen; die Umstellung und den Ziel-Commit gemeinsam im Dashboard prüfen.
3. Den freigegebenen Commit kontrolliert auf dem Produktiv-Webservice deployen; nicht versehentlich einen älteren Commit deployen.
4. Logs prüfen: `migration baseline ok: 21 migrations` oder bei wiederholtem Lauf `migration baseline skip: 21 migrations already registered`. Bei Abbruch **nicht** blind neu starten; Fehlermeldung untersuchen.
5. Schreibgeschützt bestätigen, dass `schema_migrations` exakt 21 erwartete Einträge mit Prüfsummen enthält. Bestehende Tabellen-/Konten-/Projektzahlen mit der vorigen Bestandsaufnahme vergleichen.
6. Beide Sonder-Variablen **wieder entfernen bzw. deaktivieren** und einen normalen Start mit demselben Commit durchführen. `migration skip` muss den bereits registrierten Satz überspringen.
7. `/api/health`, `/api/ready`, HTTP-Zugriffsschutz, Login/Accounts, Creator-Funktionen sowie die konfigurierten Integrationen kontrollieren; Logs auf Fehler prüfen.
8. Produktiven Auto-Deploy nicht ohne gesonderte Freigabe aktivieren.

## Zusätzliche, offene Punkte

- Auf Free-Webservices gibt es **keine Persistent Disk**. Datei-Uploads im lokalen Dateisystem können nach Neustart/Deploy verloren gehen.
- Die Staging-Instanz hat bislang keine Datenbankkopie für einen realistischen Baseline-Test.
- PRs #21 und #22 stehen unabhängig davon noch zur Prüfung; ein Merge erfolgt nur nach ausdrücklicher Freigabe.
- Ein fehlendes Backup ist **kein** grüner Status und wird durch einen erfolgreichen CI-Test nicht ersetzt.
