# CFS Zockt Backend

Der Render-Service startet die Anwendung mit:

```text
npm ci
npm start
```

Der Server läuft auf `process.env.PORT` und stellt aktuell diese stabilen Endpunkte bereit:

- `GET /api/health`
- `GET /api/ready`
- `GET /api/public/status`
- `GET /api/public/live-session`
- `GET /api/public/community-stats`
- `GET /api/public/creator-state`
- `GET /api/public/games`
- `GET /api/account/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/creator/projects`
- `POST /api/creator/projects`
- `PATCH /api/creator/projects/:id`
- `DELETE /api/creator/projects/:id`
- `GET /api/creator/widget-studio/scenes`
- `POST /api/creator/widget-studio/scenes`
- `PUT /api/creator/widget-studio/scenes/:id`
- `POST /api/creator/widget-studio/scenes/:id/publish`
- `GET /api/creator/widget-studio/widgets`
- `POST /api/creator/widget-studio/widgets`
- `GET /api/creator/widget-studio/widgets/:id`
- `PUT /api/creator/widget-studio/widgets/:id/draft`
- `POST /api/creator/widget-studio/widgets/:id/publish`
- `GET /api/creator/widget-studio/assets`
- `POST /api/creator/widget-studio/assets`

Noch nicht aktivierte API-Bereiche liefern absichtlich `501 API_NOT_IMPLEMENTED`, statt einen unklaren Serverfehler zu erzeugen.

`/api/health` prüft nur, ob der Prozess läuft. `/api/ready` prüft zusätzlich, ob `DATABASE_URL` für die nächste Persistenzstufe gesetzt ist. Solange noch keine Datenbank verbunden ist, antwortet `/api/ready` mit `503 waiting_for_database`.

## Nächste Backend-Module

1. PostgreSQL-Verbindung über `DATABASE_URL`
2. Migrationen für Accounts, Sessions und Creator-Projekte
3. Session-/CSRF-Schutz
4. Widget-, Scene- und Shop-APIs
5. Twitch-/TikTok-Integrationen
6. Admin-Berechtigungen und Audit-Logging

Das Datenmodell liegt unter `migrations/001_initial.sql`, `migrations/002_project_versions.sql` und `migrations/003_creator_assets.sql`. Die Migrationen sind absichtlich noch nicht automatisch im Startprozess verankert, damit ein Render-Neustart niemals ungefragt Datenbankänderungen ausführt.

Uploads werden in der aktuellen Stufe lokal unter `assets/uploads/` abgelegt. Für einen dauerhaft sicheren Render-Betrieb muss dieser Speicher später durch einen persistenten Object-Storage (z. B. S3-kompatibel) ersetzt werden.

Keine geheimen Werte in dieses Repository eintragen. Render-Environment-Variablen bleiben ausschließlich im Render-Dashboard.

