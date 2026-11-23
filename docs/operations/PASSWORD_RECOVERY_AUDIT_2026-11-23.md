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

