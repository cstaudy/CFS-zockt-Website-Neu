# Environment-Audit

Dieses Dokument beschreibt den aktuellen Codezustand, nicht den Inhalt deines
Render-Dashboards. Werte niemals hier eintragen.

## Aktuell vom Code gelesen

| Variable | Status | Verwendung |
|---|---|---|
| `DATABASE_URL` | Pflicht | PostgreSQL und automatische Migrationen |
| `DATABASE_SSL` | optional | SSL-Verhalten der PostgreSQL-Verbindung |
| `DB_POOL_MAX` | optional | Größe des PostgreSQL-Pools |
| `PORT` | optional | Render setzt standardmäßig 10000 |
| `HOST` | optional | Standard `0.0.0.0` |
| `NODE_ENV` | optional | Statusausgabe |
| `SESSION_SECRET` | vorbereitet | wird aktuell nicht für Sessions verwendet |
| `APP_VERSION` | optional | Fallback für Versionsanzeige |
| `RENDER_GIT_COMMIT` | Render | Versionsanzeige, automatisch vorhanden |
| `TWITCH_CLIENT_ID` | optional | nur Konfigurationsstatus |
| `TWITCH_CLIENT_SECRET` | optional | nur Konfigurationsstatus |
| `TIKTOK_CLIENT_KEY` | optional | nur Konfigurationsstatus |
| `TIKTOK_CLIENT_SECRET` | optional | nur Konfigurationsstatus |
| `LAUNCHER_BRIDGE_SECRET` | optional | nur Konfigurationsstatus |
| `PAYPAL_CLIENT_ID` | optional | nur Konfigurationsstatus |
| `PAYPAL_CLIENT_SECRET` | optional | nur Konfigurationsstatus |
| `PSN_PROVIDER` | optional | nur Konfigurationsstatus |
| `PSN_CLIENT_ID` | optional | nur Konfigurationsstatus |
| `ASSET_STORAGE_PROVIDER` | optional | local/Object-Storage-Status |
| `ASSET_STORAGE_BUCKET` | optional | nur Storage-Status |

## Im aktuellen Code nicht gelesen

Diese Variablen können aus Render entfernt werden, sofern kein anderer externer
Dienst sie benötigt:

```text
PAYPAL_MODE
PAYPAL_WEBHOOK_ID
PSN_CLIENT_SECRET
PSN_WEBHOOK_SECRET
ASSET_STORAGE_ENDPOINT
RENDER_SERVICE_ID
```

## Wichtige Interpretation

`true` im Endpoint `/api/integrations/status` bedeutet derzeit nur, dass die
erforderlichen Variablen vorhanden sind. Es bedeutet noch nicht, dass Twitch,
TikTok, PlayStation, PayPal oder der Launcher erfolgreich verbunden sind.

Für die aktuelle Datenbankfunktion sind nur diese Variablen wirklich erforderlich:

```text
DATABASE_URL
DATABASE_SSL=true
DB_POOL_MAX=5
SESSION_SECRET=<zufälliger Wert für spätere Integrationen>
```
