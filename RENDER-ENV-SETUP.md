# Render-Variablen

## Pflichtvariablen

Im Render-Service unter **Environment** eintragen:

| Name | Wert |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL-Connection-String der Render-Datenbank |
| `DATABASE_SSL` | `true` |
| `DB_POOL_MAX` | `5` |
| `SESSION_SECRET` | langer zufälliger Wert; siehe unten |

Wenn Web Service und PostgreSQL als Render-Ressourcen im selben Blueprint angelegt
sind, sollte bevorzugt die interne PostgreSQL-URL verwendet werden. Den exakten
Wert nicht in Git committen, sondern über Render Environment setzen.

## Sicheren Secret-Wert erzeugen

Lokal mit Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Den ausgegebenen Wert ausschließlich als Render-Variable `SESSION_SECRET`
eintragen. Nicht in `.env.example`, Quellcode oder Chatverläufe übernehmen.

## Optionale Variablen

Diese Variablen erst setzen, wenn die jeweilige Integration tatsächlich aktiviert
wird:

```text
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
LAUNCHER_BRIDGE_SECRET
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
PSN_PROVIDER
PSN_CLIENT_ID
PSN_CLIENT_SECRET
PSN_WEBHOOK_SECRET
ASSET_STORAGE_PROVIDER=local
ASSET_STORAGE_BUCKET
ASSET_STORAGE_ENDPOINT
```

## Deploy-Reihenfolge

1. PostgreSQL-Datenbank in Render anlegen.
2. `DATABASE_URL` und die Pflichtvariablen im Web Service setzen.
3. Den Web Service deployen; `npm start` führt die idempotenten Migrationen bei gesetzter
   `DATABASE_URL` automatisch aus.
4. `/api/health` und `/api/ready` prüfen. Erwartet wird bei beiden HTTP 200.

Die Migrationen sind idempotent und werden bei jedem Start erneut geprüft. Ein normaler
Neustart führt dadurch keine doppelten Schemaänderungen aus. Schlägt eine Migration fehl,
startet der Service nicht mit einem unvollständigen Datenbankschema.

## Aktueller Hinweis

`SESSION_SECRET` ist bereits als Konfigurationsvariable vorgesehen. Die aktuelle
Login-Session verwendet jedoch zufällige, datenbankgestützte Tokens und keine
signierten Cookies. Die Variable sollte trotzdem gesetzt werden, damit die
Render-Konfiguration vollständig ist und spätere Integrationen einen sicheren
Secret-Wert vorfinden.
