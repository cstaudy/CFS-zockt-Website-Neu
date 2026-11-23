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

`npm run check` und einzelne Child-Process-Tests bleiben in der Windows-Audit-Umgebung durch das bereits dokumentierte `spawn EPERM`/fehlende Bash blockiert. Der Contract-Test und der isolierte PostgreSQL-Recovery-Test sind für Ubuntu-GitHub-CI als eigene Schritte hinterlegt; die ersten Linux-Läufe scheiterten an veralteten Migrationszählern bzw. einem Test-Token-Parser und sind im aktuellen Commit `1b3fe50` korrigiert. Ein echter Provider-Versand bleibt ohne freigegebene Resend-Konfiguration bewusst **BLOCKED**.

## Noch erforderliche Betreiber-/CI-Schritte

1. GitHub-CI-Lauf auf Linux nach Commit `1b3fe50` abwarten und die Migration 026 nur in der isolierten CI-/Staging-Datenbank ausführen.
2. Resend-API-Key, verifizierten `MAIL_FROM`-Absender und HTTPS-`APP_BASE_URL` ausschließlich als geschützte Environment-Variablen konfigurieren.
3. Mit einer synthetischen Testadresse den E-Mail-Inhalt und den vollständigen Reset auf einem isolierten Neon-Branch abnehmen. Keine echten Nutzer-E-Mails senden.
4. Erst nach Freigabe darf ein separater Produktions-Rollout geplant werden; kein automatischer Merge/Deploy ist Teil dieses PRs.

## Read-only Produktionsfreigabeprüfung (23.11.2026)

### GitHub

PR #103 ist weiterhin Draft, offen und nicht gemergt. Commit `01fb171e3378588407f3d46e3c9cb73549168e7a` ist aktuell. GitHub Actions Lauf [45167398052](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45167398052), Run 662, ist vollständig erfolgreich: `npm run check`, Recovery-Contract, PostgreSQL-Recovery-Integration, Legacy-Upgrade, Dump/Restore und verschlüsselter CI-Backup-/Restore-Test.

### Render

Im verbundenen Workspace wurden read-only folgende relevante Services gefunden:

- `CFS-TikTok-Backend` (`srv-da5dhsmk1f9s738bf9a0`): Repository `CFS-zockt-Website-Neu`, Branch `main`, live auf Commit `3f8c46e`, `autoDeploy=no`, Health-Pfad `/api/health`, kostenloser Frankfurt-Service. Die Logs vom 23.11.2026 zeigen nur Migrationen 001–021.
- `cfs-zockt-staging` (`srv-dbqn7gon74is73cn7umg`): Branch `fix/staging-site-content-neon-20261122`, live auf Commit `439d7b2`, `autoDeploy=no`, kostenloser Frankfurt-Service. Die Logs zeigen Migrationen bis 025, nicht 026.
- Render-Postgres `cfs-zockt-db` (`dpg-dbp1583m8hqs73dqovs0-a`): 26 Tabellen, PostgreSQL 18.6, keine `schema_migrations`; `password_recovery_tokens` existiert, `password_recovery_attempts` fehlt.

Die Render-MCP-Schnittstelle liefert Service-Metadaten, aber keine sicheren, nicht offengelegten Environment-Key-Namen/Zuordnungen. Deshalb ist nicht beweisbar, ob der aktive Service seine `DATABASE_URL` auf Render Postgres, Neon oder eine andere Datenbank richtet.

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

**BLOCKED – nicht mergen, nicht deployen.** Offen sind die eindeutige aktive Datenbankzuordnung, geschützte Resend-/Render-Konfigurationsprüfung, ein vollständiges verschlüsseltes Backup der tatsächlich aktiven Datenbank mit isoliertem Restore und die Prüfung der Migration-026-Kompatibilität auf genau diesem Ziel. Der erfolgreiche CI-Lauf verwendet ausschließlich eine synthetische Wegwerf-PostgreSQL-Datenbank und ersetzt diese Nachweise nicht.

