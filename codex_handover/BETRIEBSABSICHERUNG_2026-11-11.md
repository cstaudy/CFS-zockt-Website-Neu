# Betriebsabsicherung im lokalen Environment

## Änderungen

| Bereich | Umsetzung | Prüfung |
|---|---|---|
| Statische Dateien | `server.js` liefert nur öffentliche Seiten, Assets, Widgets, Games, Auth-Callback, Security-Text und die öffentliche Monetarisierungskonfiguration. Interne Dateien und Dotfiles sind gesperrt. | 51 HTML-Seiten HTTP 200; `server.js`, `.env.example`, `.git/config`, Migrationen und interne Quellen HTTP 403. |
| Uploads | `ASSET_UPLOAD_ROOT` legt einen absoluten Pfad für ein Render-Disk-Mount fest. Asset- und Medien-Uploads schreiben dorthin; bestehende `/assets/uploads/…`-URLs lesen aus demselben Pfad. | HTTP-Test mit temporärem Mount-Pfad erfolgreich. |
| Migrationen | `schema_migrations` speichert Name und SHA-256-Prüfsumme. Advisory Lock und Transaktion pro Datei verhindern parallele/teilweise Läufe; bereits ausgeführte Dateien werden übersprungen. | Lokaler Logiktest für Ausführen, Überspringen, Prüfsummenfehler und Rollback. Echte PostgreSQL-Ausführung offen. |
| OAuth-Token | Twitch und TikTok verlangen `SESSION_SECRET`, statt einen festen Ersatzschlüssel zu verwenden. Konfigurations-API zeigt den fehlenden Schlüssel an. | Konfigurationstest ohne/mit Schlüssel und Callback-Fehlerstatus erfolgreich. Echte Provider-Flows offen. |
| CI | GitHub Actions führt `npm ci` und `npm run check` bei PRs und auf `main` aus. | `npm ci` lokal erfolgreich; 0 gemeldete Vulnerabilities; `npm run check` erfolgreich. CI-Lauf erst nach Push prüfbar. |

## Render-Abnahme

- `DATABASE_URL`, `DATABASE_SSL`, `APP_BASE_URL`, `SESSION_SECRET` und Provider-Redirects sicher in Render konfigurieren. Secrets nicht in Git/Chat speichern.
- Zustandsändernde Browser-Anfragen (`POST`, `PUT`, `PATCH`, `DELETE`) werden bei einem fremden `Origin` abgewiesen. Requests ohne `Origin` bleiben für authentifizierte Launcher/API-Clients möglich.
- Readiness-Antworten melden Datenbank, OAuth, Session-Secret und persistenten Upload-Pfad anhand der tatsächlichen Konfiguration statt pauschal als bereit.
- Für dauerhafte Uploads eine Render Persistent Disk mounten und `ASSET_UPLOAD_ROOT` auf exakt diesen absoluten Mount-Pfad setzen. Ein Pfad ohne Disk ist nicht dauerhaft.
- Vor dem ersten Start gegen eine bestehende Datenbank Backup und Migrationslauf gegen eine Kopie durchführen. Es gibt lokal keine `DATABASE_URL`, keinen PostgreSQL-Server und keine Testkonten; dieser Teil ist **BLOCKED**.
- `/api/ready` muss nach dem Deploy HTTP 200 melden. Login, Rollen, Creator-Projekte, Uploads, OAuth und Bezahlabläufe in einer nichtproduktiven Umgebung prüfen.
- Upload-Dateien bleiben über ihre bisherigen unvorhersagbaren URLs öffentlich abrufbar. Ein Zugriffsschutz für private Medien erfordert einen gesonderten URL-/OBS-Vertrag; hier wurde diese bestehende Semantik nicht stillschweigend geändert.

## Rollback

Die Änderung betrifft `server.js`, Upload-Module, OAuth-Module, Migrationsrunner, Tests und Dokumentation; keine bestehende SQL-Migrationsdatei wurde geändert. Bei einem Fehler kann der vorherige Git-Commit wiederhergestellt werden. Falls `schema_migrations` bereits angelegt wurde, muss diese Tabelle für einen Code-Rollback nicht gelöscht werden. Bestehende Upload-Dateien auf einem persistenten Mount nicht entfernen.
