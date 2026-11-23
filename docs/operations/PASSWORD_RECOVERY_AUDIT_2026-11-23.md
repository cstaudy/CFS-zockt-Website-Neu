# Passwort-Recovery-Audit (Issue #102)

**Stand:** 23.11.2026  
**Basis:** `main` `7808447a26fc51d906e97bfc81d7cae4baed83cd`  
**Änderungsbranch:** `audit/issue-102-password-recovery`

## Ergebnis

**Sichere Ergänzung als Draft-PR vorbereitet; Produktionsfreigabe bleibt ausstehend.**

Die Login-Seite verlinkt bereits auf `/pages/forgot-password.html`. Die Anforderung antwortet neutral, der Reset-Link wird als Fragment (`#token=…`) versendet, die Reset-Seite entfernt ihn sofort aus der sichtbaren URL und erzwingt 15 Zeichen mit Bestätigung. Die bestehenden MFA- und Session-Funktionen bleiben beteiligt.

Vorher fehlten jedoch ein persistenter Rate-Limiter pro Konto/IP, atomarer Tokenverbrauch gegen parallele Requests, fail-closed-Mail-Konfiguration und eine sichere Origin-Prüfung.

## Ergänzungen im Draft-PR

- Migration `026_password_recovery_rate_limit.sql`: anonymisierte IP-Hashes, Konto-/IP-Zeitfenster und Indizes.
- `requestPasswordReset`: neutrale Antwort für unbekannte Konten und Rate-Limits (5 pro Konto, 30 pro IP in 15 Minuten), PostgreSQL-Transaktionssperren und keine Token-Erzeugung bei fehlender Mail-Konfiguration.
- `resetPassword`: `SELECT … FOR UPDATE` und eine Transaktion für Passwortänderung, Tokenverbrauch, Session-Invalidierung und Löschung offener MFA-Challenges.
- `src/mail.js`: nur HTTPS-App-Origin (HTTP ausschließlich localhost), keine Query-Token, Fehler des Mail-Providers werden nicht nach außen geleakt.
- Bei Provider-Fehlern wird der unverbrauchte Token entfernt; ohne `SESSION_SECRET` wird kein Versand vorbereitet.
- CI-Schritt, isolierter PostgreSQL-Integrationstest und lokaler Contract-Test für URL-, Token-, Rate-Limit-, Atomizitäts- und mobile Formularverträge.

## Bereits bestätigt

- Link „PASSWORT VERGESSEN?“ ist auf der Login-Seite vorhanden.
- E-Mail-Feld nutzt `autocomplete="email"` und `inputmode="email"`.
- Neue Passwortfelder nutzen `autocomplete="new-password"`, `minlength="15"` und Statusausgabe via `aria-live`.
- Token wird nur gehasht in `password_recovery_tokens` gespeichert; der Klartext bleibt im URL-Fragment und wird clientseitig entfernt.
- Erfolgreicher Reset beendet bestehende Sessions und offene MFA-Login-Challenges.
- Keine echte E-Mail, Produktionsdatenbank oder produktive Verbindung wurde verwendet.

## Tests

Bestanden:

```text
node scripts/test-password-recovery.mjs
node --check scripts/test-password-recovery-db.mjs
node scripts/test-migration-runner.mjs
node scripts/test-password-policy.mjs
node scripts/test-login-throttle.mjs
node scripts/test-html-integrity.mjs
node scripts/check-local-assets.js
node --check src/auth.js
node --check src/mail.js
node --check server.js
```

`npm run check` und einzelne Child-Process-Tests bleiben in der Windows-Audit-Umgebung durch das bereits dokumentierte `spawn EPERM`/fehlende Bash blockiert. Der Contract-Test und der isolierte PostgreSQL-Recovery-Test sind für Ubuntu-GitHub-CI als eigene Schritte hinterlegt; die früheren Linux-Fehler (veraltete Migrationszähler und Test-Token-Parser) sind in den Folgecommits bis `01fb171e` korrigiert. Ein echter Provider-Versand bleibt ohne freigegebene Resend-Konfiguration bewusst **BLOCKED**.

## Noch erforderliche Betreiber-/CI-Schritte

1. GitHub-CI-Lauf auf Linux nach Commit `01fb171e` beziehungsweise dem aktuellen PR-Head abwarten und die Migration 026 nur in der isolierten CI-/Staging-Datenbank ausführen.
2. Resend-API-Key, verifizierten `MAIL_FROM`-Absender und HTTPS-`APP_BASE_URL` ausschließlich als geschützte Environment-Variablen konfigurieren.
3. Mit einer synthetischen Testadresse den E-Mail-Inhalt und den vollständigen Reset auf einem isolierten Neon-Branch abnehmen. Keine echten Nutzer-E-Mails senden.
4. Erst nach Freigabe darf ein separater Produktions-Rollout geplant werden; kein automatischer Merge/Deploy ist Teil dieses PRs.

## Read-only Produktionsfreigabeprüfung (23.11.2026)

### GitHub

PR #103 ist weiterhin Draft, offen und nicht gemergt. Die Sicherheitsimplementierung wurde in `01fb171e3378588407f3d46e3c9cb73549168e7a` getestet; der aktuelle PR-Head ist `9864c484dc0cd5419a85ad334b354be8076d65dc`. GitHub Actions Lauf [45167398052](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45167398052), Run 662, und der aktuelle Lauf [45171607859](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45171607859), Run 664, sind vollständig erfolgreich: `npm run check`, Recovery-Contract, PostgreSQL-Recovery-Integration, Legacy-Upgrade, Dump/Restore und verschlüsselter CI-Backup-/Restore-Test.

### Render

Im verbundenen Workspace wurden read-only folgende relevante Services gefunden:

- `CFS-TikTok-Backend` (`srv-da5dhsmk1f9s738bf9a0`): Repository `CFS-zockt-Website-Neu`, Branch `main`, live auf Commit `3f8c46e`, `autoDeploy=no`, Health-Pfad `/api/health`, kostenloser Frankfurt-Service. Die Logs vom 23.11.2026 zeigen nur Migrationen 001–021.
- `cfs-zockt-staging` (`srv-dbqn7gon74is73cn7umg`): Branch `fix/staging-site-content-neon-20261122`, live auf Commit `439d7b2`, `autoDeploy=no`, kostenloser Frankfurt-Service. Die Logs zeigen Migrationen bis 025, nicht 026.
- Render-Postgres `cfs-zockt-db` (`dpg-dbp1583m8hqs73dqovs0-a`): 26 Tabellen, PostgreSQL 18.6, keine `schema_migrations`; `password_recovery_tokens` existiert, `password_recovery_attempts` fehlt.

Die Render-MCP-Schnittstelle liefert selbst keine geschützten Environment-Werte. Die reine Metadatenprüfung konnte die Zuordnung zunächst nicht beweisen; der spätere Laufzeitnachweis weiter unten schließt diese Lücke.

### Neon

- Projekt `cfs-zockt-render-migration`, Branch `production` (`br-patient-wind-baf5d6mx`), Datenbank `cfs_zockt_render_import`: 26 Tabellen, keine `schema_migrations`, `password_recovery_attempts` fehlt.
- Dessen Branch `staging-isolated-test` (`br-plain-thunder-baw1h5fi`): 28 Tabellen, `schema_migrations` mit 25 Einträgen, `password_recovery_attempts` fehlt. Dieser Stand ist für PR #103 noch nicht kompatibel.
- Projekt `cfs-zockt`, Branch `production` (`br-solitary-queen-b2st371j`): 79 Tabellen und ein anderes Creator-Schema; keine Legacy-`accounts`/`password_recovery_tokens`-Struktur.
- Projekt `cfs-zockt-recovery` ist archiviert.

Damit ist Migration 026 auf keiner nachweislich aktiven Produktionsdatenbank installiert. Eine Migration darf dort erst nach eindeutiger `DATABASE_URL`-Zuordnung sowie verschlüsseltem, erfolgreich isoliert wiederhergestelltem Backup ausgeführt werden.

### Resend und Deployment

Der Code prüft `RESEND_API_KEY`, `MAIL_FROM` und eine HTTPS-Origin fail-closed; Provider-Fehler entfernen den unverbrauchten Token. Eine tatsächliche Render-Konfiguration, verifizierte Resend-Domain oder Zustellung konnte ohne Zugriff auf die geschützten Environment-Werte und ohne echte Testmail nicht bestätigt werden. Die beiden gefundenen Render-Services haben `autoDeploy=no`; ein Merge würde dort nach aktuellem Read-only-Stand kein automatisches Deployment auslösen. `npm start` führt bei gesetzter `DATABASE_URL` Migrationen beim Start aus, daher wäre ein unkontrollierter Deploy mit Migration 026 ein Datenbankrisiko.

Die öffentlichen, nicht schreibenden Endpunkte wurden zusätzlich geprüft:

- `CFS-TikTok-Backend`: `/api/health` und `/api/ready` erfolgreich, `/api/account/mail/status` meldet `password_recovery_available=false` und `provider=null`; `/api/integrations/status` meldet Datenbank und Session-Secret konfiguriert.
- `cfs-zockt-staging`: `/api/health` und `/api/ready` erfolgreich, `/api/account/mail/status` meldet Resend konfiguriert; die Seite läuft aber auf dem älteren Commit `439d7b2` ohne Migration 026.
- Login-, Forgot-Password- und Reset-Seiten liefern in Staging und im aktuellen Backend HTTP 200. Es wurden keine Formulare abgesendet und keine E-Mails ausgelöst.

### Freigabestatus

**BLOCKED – nicht mergen, nicht deployen.** Zu diesem Prüfzeitpunkt waren die aktive Datenbankzuordnung, die geschützte Resend-/Render-Konfiguration, ein vollständiges verschlüsseltes Backup mit isoliertem Restore und die Migration-026-Kompatibilität auf dem echten Ziel offen. Der spätere Laufzeitnachweis klärt ausschließlich die Providerzuordnung; die übrigen Freigabegates bleiben offen.

## Fortsetzung der Blockerprüfung (23.11.2026)

### Aktueller GitHub-/Render-Stand

- PR #103 bleibt auf aktuellem Head `b171fc7fd5fed23f1c29eecafeebcf26816c6a5d` Draft, offen und ungemergt.
- Der aktuelle Lauf [45171607859 / Run 664](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45171607859) ist vollständig erfolgreich; alle Recovery-, PG18-, Dump-/Restore- und Backup-/Restore-Jobs liefen durch.
- Nach dem Dokumentationscommit `b171fc7fd5fed23f1c29eecafeebcf26816c6a5d` ist auch [Run 45173916293 / Run 665](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45173916293) vollständig erfolgreich.
- Render bestätigt erneut: `CFS-TikTok-Backend` ist auf Deploy `dep-dbpq99p5efls738n6mkg` mit Commit `3f8c46e` live; `cfs-zockt-staging` ist auf Deploy `dep-dc1e94l9fdbs73ak0ic0` mit Commit `439d7b2` live. Beide Services haben `autoDeploy=no`.
- Die gemeinsame Render-`environmentId` von Backend und Render-Postgres belegt eine gemeinsame Render-Umgebung, aber allein nicht den Inhalt von `DATABASE_URL`. Der geschützte Zielwert bleibt über die MCP-Schnittstelle nicht abrufbar; die Laufzeitkorrelation unten liefert den sicheren Nachweis.

### Isolierte Neon-Stagingprüfung

Der bestehende Neon-Branch `staging-isolated-test` (`br-plain-thunder-baw1h5fi`) wurde nicht direkt verändert. Daraus wurde der isolierte Kind-Branch `pr103-recovery-validation-20261123` (`br-curly-firefly-bacrjncy`) erstellt.

Auf diesem Kind-Branch wurde ausschließlich die PR-103-Migration in einer Transaktion ausgeführt und registriert:

- `schema_migrations`: 26 Einträge, letzter Eintrag `026_password_recovery_rate_limit.sql`.
- `password_recovery_attempts` und beide vorgesehenen Indizes sind vorhanden.
- Synthetische Rate-Limit-Testzeilen (5 Einträge) wurden erzeugt, gezählt und anschließend wieder gelöscht.
- Ein synthetischer Recovery-Token wurde einmal erfolgreich als `used_at` markiert; ein zweiter Verbrauchsversuch lieferte keine Zeile. Der Token wurde anschließend gelöscht.
- Konten- und Session-Bestände des Elternbranches wurden nicht verändert. Der Elternbranch bleibt bei 25 Migrationen.

Damit ist Migration 026 auf einem nachweislich isolierten Neon-Branch kompatibel. Das ist kein Produktionsnachweis und ersetzt weder ein Backup der aktiven Produktionsdatenbank noch einen Resend-Versandtest. Ein Snapshot konnte auf dem nicht-root Kind-Branch nicht angelegt werden (`not allowed to snapshot non-root branch`); es wurde deshalb kein Produktionssnapshot erzeugt.

### Migration-Nummerierung mit PR #50

PR #50 reserviert derzeit ebenfalls `026_launcher_job_claims.sql` und `027_twitch_follow_eventsub.sql`. PR #50 bleibt unverändert und ungemergt. Sichere Reihenfolge für eine spätere Integration:

1. PR #103 zuerst fachlich und datenbankseitig abnehmen; `026_password_recovery_rate_limit.sql` bleibt in diesem PR reserviert.
2. Vor einer Integration von PR #50 dessen Launcher-Migration auf die nächste freie Nummer nach dem dann gemeinsamen Stand umbenennen (mindestens `027_launcher_job_claims.sql`) und die nachfolgende Twitch-Migration entsprechend fortlaufend neu nummerieren.
3. Checksums, Migrationslisten, Legacy-Baseline, Dump-/Restore-Tests und Rollback-Rehearsal von PR #50 in einem isolierten Branch neu erzeugen.
4. Erst nach separater Prüfung beider PRs integrieren; keine historische `schema_migrations`-Zeile nachträglich umnummerieren oder in Produktion überschreiben.

### Weiterhin nicht nachweisbar

- Ein vollständiges, verschlüsseltes Backup der tatsächlich aktiven Render-Datenbank mit isoliertem Restore: Render MCP stellt dafür keinen Backup-/Restore-Aufruf bereit; Neon-Snapshots der Produktionskandidaten sind leer.
- Der konkrete Neon-Provider/Branch ist kein Produktionsziel; der aktive Provider ist durch die unten dokumentierte Render-Laufzeitkorrelation nachgewiesen.
- Resend-Domain-Verifizierung und synthetische Zustellung: der Backend-Live-Status meldet Recovery deaktiviert; Staging meldet Resend konfiguriert, läuft aber nicht auf PR #103.
- Ein iPhone-Formular-End-to-End-Lauf gegen eine PR-103-Staging-Instanz: die statischen mobilen Verträge und die isolierte CI-Integration sind grün, aber keine isolierte Render-Instanz mit PR #103 ist aktiv.

**Aktualisierter Status: BLOCKED.** Es wurden nur isolierte Neon-Stagingdaten verändert; keine Produktionsdatenbank, keine Render-Konfiguration, kein Deployment und keine echte E-Mail wurden angefasst.

## Definitiver Laufzeitnachweis der Produktionsdatenbank (23.11.2026)

### Ergebnis: **RENDER VERIFIED**

Die bisherige Zuordnungslücke wurde durch eine zeitnahe, ausschließlich lesende Laufzeitkorrelation geschlossen:

1. Der produktive Service `CFS-TikTok-Backend` antwortete auf `GET /api/ready` mit HTTP 200, `database.configured=true`, `database.connected=true` und Version `3f8c46e`.
2. Der Code des live laufenden Commits `3f8c46e` verwendet ausschließlich `process.env.DATABASE_URL`; `/api/ready` ruft `databaseCheck()` auf, und `databaseCheck()` führt exakt `select 1` aus.
3. Unmittelbar nach dem Health-GET erschien auf Render-Postgres `cfs-zockt-db` eine neue Idle-Sitzung mit `query_preview="select 1"`, `usename=cfs_zockt_db_user`, Render-internem `client_addr` und dem Zeitstempel des Health-Aufrufs.
4. Ein gleichartiger Health-GET auf `cfs-zockt-staging` erzeugte keine entsprechende Render-Postgres-Sitzung. Das trennt die produktive Render-Verbindung vom Staging-Pfad.

Damit verwendet `CFS-TikTok-Backend` nachweislich **Render PostgreSQL `cfs-zockt-db` (`cfs_zockt_db`)**, nicht eines der Neon-Projekte. Die Render-Umgebungs-ID `evm-da5dhsbncjis738jcehg` stimmt zusätzlich zwischen Backend und Render-Postgres überein. Secret-Werte und vollständige Connection-Strings wurden nicht gelesen oder ausgegeben.

### Konsequenzen

- Neon ist derzeit **nicht produktiv verbunden**. Die passenden Legacy-Daten liegen im Neon-Projekt `cfs-zockt-render-migration`, Branch `production` (`br-patient-wind-baf5d6mx`), Datenbank `cfs_zockt_render_import`; dieser Branch ist jedoch kein nachgewiesenes Laufzeit-Ziel.
- Die alte Render-Datenbank wird aktuell noch benötigt. Sie läuft laut Render-Metadaten am 09.12.2026 ab; eine Umstellung darf erst nach Backup/Restore und kontrolliertem Cutover erfolgen.
- Die aktive Render-Datenbank hat 26 Tabellen, aber keine `schema_migrations` und keine `password_recovery_attempts`. Migration 026 ist dort nicht installiert und darf nicht beim normalen Start blind angewendet werden.
- Der isolierte Neon-Kindbranch `br-curly-firefly-bacrjncy` bleibt ausschließlich Testumgebung; seine erfolgreiche Migration-026-Prüfung beweist keine Produktionsmigration.

Der Gesamtfreigabestatus bleibt deshalb **BLOCKED**: Die Providerfrage ist geklärt, aber das verschlüsselte Produktionsbackup mit isoliertem Restore, der sichere Neon-Datenabgleich/Cutover, der Resend-Test und die Rollback-Vorbereitung fehlen weiterhin.

