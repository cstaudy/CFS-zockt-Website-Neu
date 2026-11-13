# Adminrollen-Härtung – Freigabe und Rollout

**Status: Draft, kein Produktions-Rollout.** Dieser Branch basiert auf dem aktuellen `main` und ersetzt E-Mail-basierte Adminrechte durch die kombinierte Prüfung:

1. Vorgesehene Betreiber-E-Mail
2. Explizite Datenbankrolle `accounts.role = 'admin'`
3. Verifizierte E-Mail (`accounts.email_verified_at IS NOT NULL`)

Die Rechte werden beim Laden jeder Sitzung aus der Datenbank neu bewertet. MFA-Anmeldung, Sitzungen und Recovery sind weiterhin erforderlich. Das Anlegen oder Umschreiben von Berechtigungen ist **nicht** Teil des Branches.

## Vor einem Merge erforderlich

- Autorisierten Betreiberzugang und ein aktuelles, tatsächlich wiederherstellbares Produktionsbackup nachweisen
- Manuell auf einem isolierten Restore-Klon prüfen: `CONFIRM_ADMIN_PREFLIGHT_READ_ONLY=yes npm run admin:preflight`
- Wenn `ready=false`: Betreiberrolle und Verifizierung **nicht automatisch** setzen; Eigentumsnachweis und gesonderten freigegebenen Migrationsplan einholen
- PostgreSQL-Integrationstests für erlaubte / verweigerte / widerrufene Rechte sowie MFA absolvieren
- Vor Deploy produktiven Rollback/Restore und Render-Startverhalten prüfen; `scripts/start.js` führt bei gesetzter `DATABASE_URL` Migrationen aus
- Erst nach ausdrücklicher separater Release-/DB-Freigabe mergen und ausrollen

## Abgrenzung

Die parallel laufende Creator-Erweiterung #50 enthält zusätzliche Migrationen 026/027 und ist separat abzunehmen. Diese Admin-Härtung ändert weder das bestehende Schema noch die Migrationen. Nicht in die alte Admin-Fassung #26 oder die historischen MFA-Stapel-PRs zurückführen.
