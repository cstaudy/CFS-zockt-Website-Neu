# cfs_zockt Render-Abnahme

## 1. Vor dem Deployment

In Render nur die Werte prüfen, niemals Secrets in Git eintragen:

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_BASE_URL`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_REDIRECT_URI`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENVIRONMENT`
- `PAYPAL_CATALOG_JSON`
- `LAUNCHER_BRIDGE_SECRET`
- `LAUNCHER_VERSION`
- `STORAGE_BUCKET` oder `S3_BUCKET`

## 2. Nach dem Deploy

1. `GET /api/ready` muss `ok: true`, Datenbank `configured: true` und `connected: true` liefern.
2. `GET /api/creator/integration-capabilities` nur nach Login prüfen.
3. `GET /api/creator/technical-status` und `/api/creator/suite-readiness` prüfen.
4. Migrationen bis `021_creator_settings.sql` in den Render-Logs bestätigen.

## 3. Browserabnahme

- Startseite: Branding `cfs_zockt`, keine sichtbare Design-Galerie, keine verschobenen Buttons.
- Login/Registrierung: horizontale Rechtstexte, fester Anzeigen-Button, keine Layoutbewegung.
- Creator Suite: Navigation und Karten bleiben horizontal und lesbar.
- Widget Studio: Bildauswahl, Upload, Speichern und Vorschau testen.
- Stream Studio: Laden, Speichern, Audio-/LIVE-Status testen.
- Stream Maker: Katalog, eigene Bilddatei, Vorschau und Übergabe zum Widget Studio testen.
- Shop: 31 Designs, 496 Farbvarianten und Vorschauen prüfen; ZIP-Download nur testen, wenn Storage freigegeben ist.
- Admin: Control Center, Supportmeldungen und Rechteprüfung testen.

## 4. Integrationen

- TikTok-Login und Callback testen.
- Twitch-Login und Callback testen.
- Launcher registrieren, Heartbeat und OBS-Status prüfen.
- PayPal nur mit freigegebenem Katalog und korrekter Umgebung testen.

Passkeys, CFS-AI, CFSON-Produktbetrieb und kostenpflichtige Planwechsel bleiben bis zur jeweiligen Providerfreigabe deaktiviert.

