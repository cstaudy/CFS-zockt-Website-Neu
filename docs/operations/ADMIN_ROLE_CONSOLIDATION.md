# Admin-Rollen-Konsolidierung und Betreiber-Freigabe

Stand 28.11.2026, SEC-01, Folge zu #103. Bestehende Regel aus src/admin-access.js auf aktuellen Recovery-Branch angewendet, nicht #26/#47/#52 pauschal gemerged.

## Befund
Read-only Neon-Prüfung der Betreiberbereitschaft (ausschließlich boolesche Ergebnisse): production und wiederhergestellte Sicherungsdatenbank vom 26.11. jeweils account_exists=true, role_ready=false, email_ready=false. Keine Kontodaten ausgegeben, keine Änderungen. Strenge Aktivierung würde aktuell den Betreiber aussperren. Deshalb **Release blockiert**.

## Code
Ein gemeinsamer Account-View/Policy-Helper verwendet vorhandene E-Mail-Zuordnung, explizite DB-Rolle admin und bestätigte E-Mail. Passwort-Login liest auch email_verified_at; Session, MFA-Login, Account-Me, Profil, requireAdmin, Admin-Liste und Creator-Settings verwenden dieselbe Regel. Keine Rollenänderung in DB, keine neue Migration, keine Änderung an MFA-Challenge/Recovery oder Registrierung der Berechtigungen. MFA bleibt bei aktivierter MFA Voraussetzung für eine neue Session. Die Regel erzwingt noch nicht die Einrichtung von MFA für alle Admins; Betreiberabnahme verlangt dies gesondert.

## Abnahme vor produktiver Aktivierung
1. #103, #108, #109 und diesen Folge-PR gezielt konsolidieren. #47/#52/#26 historische Alternativen, nicht zusätzlich mergen. #50, #110 betreffen server.js; Tests und bestehende API erhalten.
2. Vollständiger verifizierter unabhängiger Backup/Restore, isolierter Restore-Klon und Migrationsinventar. Auf dem Klon die vorhandene Betreiberidentität mit dem Betreiber verifizieren, E-Mail über bestehenden sicheren Bestätigungsweg bestätigen, explizite Rollenvergabe ausschließlich durch autorisierten Operator mit eigener Freigabe dokumentieren. Niemals Rolle/E-Mail-Bestätigung aus einer Behauptung oder aus einem Match alleine ableiten.
3. Bestehenden read-only admin:preflight (Opt-in) prüfen. MFA-Einrichtung, Recovery, Login mit zweitem Faktor, Session-/Rechteentzug und alternativen autorisierten Recovery-Weg auf dem Klon abnehmen. Kein Passwort, Token oder Identitätsdatum im Bericht.
4. Separate Betreiberfreigabe für produktive Rollenprovisionierung und danach Deployment. Vor Aktivierung readiness=true und verifizierter Zugang; bei Fehler abbrechen, nicht automatisch alte E-Mail-basierte Adminrechte als Fallback aktivieren. Rollback separat sicherheitsbewerten, kein unkontrollierter DB-Restore.

CI: bestehender Admin-Preflight-Test ergänzt, lokaler PostgreSQL-HTTP-Test für E-Mail allein, Rolle ohne Verifikation, vollständige Kombination, MFA-Pending, erfolgreiche MFA-Anmeldung, unmittelbaren Rechteentzug und fremde Adminrolle. CI noch offen; keine echte Betreiberanmeldung getestet. Keine produktive Änderung, kein Merge/Deploy.