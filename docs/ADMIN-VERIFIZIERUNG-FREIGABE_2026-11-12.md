# Admin-Zugang: Prüfung vor Freigabe

## Sicherheitsproblem

Bisher wurde die Admin-Berechtigung ausschließlich aus einer fest hinterlegten E-Mail-Adresse abgeleitet. Diese Adresse konnte bei der Registrierung eingegeben werden, ohne dass E-Mail-Verifizierung für die Admin-Berechtigung erforderlich war.

Mit diesem Branch benötigt ein Admin-Account gleichzeitig:
- die fest hinterlegte Admin-E-Mail-Adresse,
- die ausdrücklich in PostgreSQL gesetzte Rolle `admin`,
- eine bestätigte E-Mail-Adresse (`email_verified_at IS NOT NULL`).

Ein Konto mit derselben E-Mail-Adresse, aber mit Rolle `creator` oder ohne E-Mail-Bestätigung, hat **keine** Admin-Rechte mehr. Dadurch entfällt der unsichere automatische Admin-Aufstieg.

## Stand der Bestandsaufnahme (12. November 2026)

Schreibgeschützte Prüfung der bestehenden Produktionsdatenbank:
- 1 Konto insgesamt,
- 0 Konten mit ausdrücklich vergebener Rolle `admin`,
- das Konto mit der hinterlegten Admin-E-Mail-Adresse hat keine E-Mail-Bestätigung,
- das bestehende Konto darf nach dieser Codeänderung **noch keine** Admin-Funktionen nutzen.

**Folge:** Dieser PR darf nicht ohne vorbereitete und überprüfte Admin-Wiederherstellung in Produktion deployt werden.

## Sichere Freigabe-Voraussetzungen

1. Prüfen, dass das bestehende Konto tatsächlich dem berechtigten Website-Betreiber gehört. Besitz dieser E-Mail-Adresse **nicht** allein aus dem DB-Eintrag ableiten.
2. E-Mail-Zustellung über den konfigurierten Provider prüfen und die vorhandene E-Mail-Verifikation abschließen. Keine Token im Chat, in Git oder in Protokollen teilen.
3. Nach Identitätsprüfung und ausdrücklicher Freigabe durch den Betreiber die Rolle **nur für das verifizierte Betreiberkonto** in der Datenbank auf `admin` setzen. Kein automatischer Rollenaufstieg beim Registrieren oder Verifizieren.
4. In einer nichtproduktiven Umgebung testen: verifiziertes Betreiberkonto erhält Admin-Zugriff; unbestätigtes oder normales Creator-Konto erhält HTTP 403. Bestehende Sitzungen, Login und Logout prüfen.
5. Erst nach einem getesteten Datenbankbackup (siehe `docs/RENDER-PRODUKTIV-BASELINE-ABNAHME_2026-11-12.md`) das Deployment gesondert freigeben.

## Grenzen der Änderung

- Der E-Mail-Adresse-Match bleibt als zusätzliche Schranke erhalten. Eine künftig flexible Admin-Verwaltung ist damit **nicht** eingeführt.
- Kein MFA-/2FA-Login-Flow implementiert. Ein aktiviertes TOTP-Setup darf **nicht** als vollständige Login-2FA betrachtet werden, bevor der Login-Challenge-Flow separat überprüft und umgesetzt wurde.
- Keine Datenbankmutation in diesem Branch, keine Migration, keine automatischen Admin-Role-Upgrades.
- Ein erfolgreiches `npm run check` ersetzt **keinen** realen Login-/Admin-/E-Mail-Verifizierungs-Integrationstest.

**Nicht mergen oder deployen ohne ausdrückliche Freigabe.**
