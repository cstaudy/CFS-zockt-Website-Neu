# CFS-Zockt · Render Environment

Diese Liste ist für den aktuellen Backend-Code und die nächsten Integrationen.
Keine echten Secrets in GitHub oder in diese Datei eintragen.

## Sofort erforderlich

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=10000
DATABASE_URL=<Render Internal Database URL>
DATABASE_SSL=true
DB_POOL_MAX=5
SESSION_SECRET=<langer zufälliger Wert>
APP_BASE_URL=https://cfs-zockt.de
```

## TikTok OAuth · jetzt eintragen

```text
TIKTOK_CLIENT_KEY=<TikTok Client Key>
TIKTOK_CLIENT_SECRET=<TikTok Client Secret>
TIKTOK_REDIRECT_URI=https://cfs-tiktok-backend.onrender.com/api/auth/tiktok/callback
```

Diese URL muss im TikTok Login Kit exakt als Redirect URI registriert sein:

```text
https://cfs-tiktok-backend.onrender.com/api/auth/tiktok/callback
```

## Twitch · später

```text
TWITCH_CLIENT_ID=<Twitch Client ID>
TWITCH_CLIENT_SECRET=<Twitch Client Secret>
TWITCH_REDIRECT_URI=https://cfs-zockt.de/auth/twitch/callback
```

## Launcher · später

```text
LAUNCHER_BRIDGE_SECRET=<langer zufälliger Wert>
```

## PlayStation · später

```text
PSN_PROVIDER=<Provider nach Festlegung>
PSN_CLIENT_ID=<Client ID nach Festlegung>
```

## PayPal Sandbox · später

```text
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<PayPal Sandbox Client ID>
PAYPAL_CLIENT_SECRET=<PayPal Sandbox Client Secret>
PAYPAL_WEBHOOK_ID=<PayPal Sandbox Webhook ID>
```

## Storage

Für lokale Tests genügt:

```text
ASSET_STORAGE_PROVIDER=local
```

Für dauerhafte Creator-Uploads auf Render eine Persistent Disk mounten und ihren absoluten Mount-Pfad eintragen:

```text
ASSET_UPLOAD_ROOT=/var/data/cfs-uploads
```

Ohne diese Disk gehen lokal gespeicherte Uploads bei Neustarts und Deploys verloren. Der Pfad muss exakt zum Mount-Pfad in Render passen. `ASSET_STORAGE_BUCKET` allein aktiviert im aktuellen Code keinen Object-Storage-Upload.

Für eine spätere echte Object-Storage-Implementierung wäre zusätzlich nötig:

```text
ASSET_STORAGE_BUCKET=<Object Storage Bucket>
```

## Nicht neu anlegen

Die alten, nicht angeschlossenen Variablen mit `CFS_`-Prefix werden für den
aktuellen Code nicht benötigt. Dazu zählen insbesondere alte PSN-, AI-, MFA-,
Admin-Elevation-, CSRF- und Launcher-Varianten.

## Deploy-Reihenfolge

1. Pflichtvariablen eintragen; Provider-Variablen nur für tatsächlich freigegebene Integrationen setzen.
2. Aktuellen Code in das mit Render verbundene GitHub-Repository committen.
3. Render deployen.
4. `/api/ready` prüfen.
5. `/api/integrations/status` prüfen.
6. TikTok-Verbindung über `/api/integrations/tiktok/start` starten.

Alle noch nicht protokollierten Datenbankmigrationen laufen beim Start automatisch, sobald `DATABASE_URL` gesetzt ist. Vor dem ersten Start mit einer bestehenden Datenbank Backup und Staging-Durchlauf durchführen. Der Produktionsstart darf erst nach erfolgreichem `/api/ready` und geprüften Logs als bereit gelten.
