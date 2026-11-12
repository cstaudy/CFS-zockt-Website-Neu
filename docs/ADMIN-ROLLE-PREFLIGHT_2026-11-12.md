# Admin-Zugang: Umstellung ohne Aussperren

**Status:** Nur Entwicklungsentwurf. Kein produktiver Rollout, keine Änderung bestehender Konten oder Rollen.

## Sicherheitsanforderung

Die geplante Adminprüfung setzt **alle drei** Bedingungen voraus:
1. Genau die fest konfigurierte Betreiber-E-Mail.
2. Den expliziten Datenbankwert `accounts.role = 'admin'`.
3. Ein vorhandenes `accounts.email_verified_at`.

Passende E-Mail allein genügt niemals. Die Rechte werden bei jeder Anfrage neu aus dem aktuellen Datenbankzustand ermittelt. Ein erfolgreicher MFA-Login ändert diese Bedingungen nicht; ein noch offener MFA-Schritt besitzt überhaupt keine Sitzung.

## Rein lesende Vorprüfung

Für einen **zuvor autorisierten** Prüfzeitpunkt steht folgender Befehl bereit:

```sh
CONFIRM_ADMIN_PREFLIGHT_READ_ONLY=yes npm run admin:preflight
```

Die `DATABASE_URL` muss dabei ausdrücklich auf den **freigegebenen Zielserver** zeigen. Der Befehl beginnt eine `READ ONLY`-Transaktion, fragt nur die drei Freigabebedingungen ab, beendet die Transaktion mit `ROLLBACK` und gibt ausschließlich Booleans aus. Er zeigt **keine** E-Mail-Adresse, Konto-ID, Passwörter, Tokens, Sitzungen oder personenbezogene Datensätze an. Fehlender Opt-in oder eine unvollständige Rolle/Verifikation führt zum Abbruch beziehungsweise Exitcode 2. `ready=true` ist nur ein Teil der Freigabe und **nicht** selbst eine Erlaubnis zum Deploy.

## Vorgehen vor produktiver Freigabe

1. Bestehende Render-Datenbank vor Ablauffrist extern sichern, vollständigen PostgreSQL-Restore auf isolierter Datenbank nachweisen.
2. Altbestand und Migrationshistorie auf dem isolierten Restore-Klon prüfen (historische Baseline 001–021, danach ausstehende 022–025); keine automatische Baseline.
3. Betreiberkonto **auf dem Klon** untersuchen und `admin:preflight` dort ausführen; fehlende Rolle oder E-Mail-Verifikation ausdrücklich dokumentieren.
4. Nie stillschweigend die E-Mail als verifiziert markieren und nie Admin-Rechte für nicht berechtigte Nutzer setzen. Erst nach gesonderter Eigentumsbestätigung und schriftlich freigegebener Migration könnte ein berechtigter Betreiber die passende Rolle erhalten.
5. MFA-Login, Admin-Oberflächen, Entzug der Berechtigung und Datenisolierung auf dem Klon testen.
6. Erst nach gesonderter Deployment- und Datenbankfreigabe ein echtes Rollout-Verfahren planen. Ein GitHub-Merge ersetzt diesen Schritt nicht.

**Kritisch:** Der ältere Entwurf #26 ist nicht mit dem heutigen MFA-Login synchron. Nicht unverändert übernehmen. Dieser neue Entwurf bewahrt den bestehenden MFA-/Login-Code.
