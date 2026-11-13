# Twitch Follow-Events → Creator-Widgets (Entwicklungsstand)

**Status:** EventSub-Webhooks, Signaturprüfung, Subscription-Anforderung und die
öffentlichen Widgets `twitch_latest_follower`/`twitch_follow_alert` sind
implementiert und automatisiert getestet. **Es ist noch keine echte Twitch-
Subscription in einer produktiven Umgebung nachgewiesen.** Keine TikTok-LIVE-
oder Twitch-Chat-Events werden aus diesen Daten abgeleitet.

## Voraussetzungen für eine spätere kontrollierte Inbetriebnahme

1. PostgreSQL-Migration `027_twitch_follow_eventsub.sql` mit dem
   normalen, überprüften Migrationsprozess ausführen. Vorher verifiziertes
   Backup und Legacy-Baseline-Regeln beachten.
2. `TWITCH_CLIENT_ID` und `TWITCH_CLIENT_SECRET` konfigurieren.
3. Für den öffentlich erreichbaren EventSub-Callback eine HTTPS-Domain
   (Port 443) festlegen: `APP_BASE_URL` oder
   `TWITCH_EVENTSUB_CALLBACK_URL=https://<domain>/api/webhooks/twitch/eventsub`.
4. `TWITCH_EVENTSUB_SECRET` als kryptografisch zufälligen, druckbaren
   ASCII-String mit 32–100 Zeichen **nur als Server-Secret** hinterlegen.
   Er muss bei der Subscription-Erstellung und Webhook-Verifikation identisch
   sein. Nicht in Git, URLs, Logs oder Browserdaten veröffentlichen.
5. Twitch per OAuth neu verbinden. Der Antrag enthält
   `moderator:read:followers` zusätzlich zu `user:read:email`.
6. Im Creator-Bereich **Verbindungen → Follow-Events aktivieren**.
   Die serverseitige Aktion `POST /api/creator/twitch/follow-events/enable`
   fordert mit einem App Access Token `channel.follow` Version 2 an.
   Twitch bestätigt die Webhook-URL mit einer signierten Challenge.
7. `GET /api/creator/twitch/follow-events/status` kontrollieren.
   Erst nach bestätigter Subscription werden echte Follow-Nachrichten
   für das verknüpfte Konto verarbeitet.

## Webhook-Verhalten

- `POST /api/webhooks/twitch/eventsub` akzeptiert nur mit
  `TWITCH_EVENTSUB_SECRET` signierte, zeitlich aktuelle Twitch-Nachrichten.
- Der HMAC-SHA256 verwendet **unveränderte Rohdaten**:
  Message-ID + Timestamp + Body. Browser-Cookies und Origin sind hierfür
  keine Authentifizierungsfaktoren.
- Die Subscription-ID und Broadcaster-ID müssen dem aktuell verknüpften
  Creator gehören. Wiederholungen derselben Message-ID werden in PostgreSQL
  nicht erneut als Follow gespeichert.
- Auch wenn die Challenge **vor** der Antwort der Subscription-API eingeht,
  wird die Verifizierung serverseitig vermerkt.
- Bei neuen Follow-Nachrichten werden Einträge älter als 30 Tage sowie
  Einträge oberhalb von 500 pro Konto bereinigt. Bei längerer Inaktivität
  ist eine zusätzliche regelmäßige Löschroutine für die Aufbewahrungsfrist
  noch nachzurüsten. Der öffentliche OBS-Endpunkt stellt nur den bestätigten
  Follower-Anzeigenamen und Ereigniszeitpunkt bereit, niemals OAuth-Tokens.
- `Latest Follower` verwendet den neuesten bestätigten Follow.
  `Follow Alert` erscheint nur innerhalb des kurzen Ereignisfensters
  (45 Sekunden) und wird anschließend auch ohne Netzwerkaufruf ausgeblendet.
- Ein Follow **beweist keinen laufenden Twitch-Stream**.
  Twitch-Live-Timer verwenden weiterhin die separate Live-Statusquelle.
- Bei einer Twitch-Revocation werden gespeicherte Followernamen sofort
  gelöscht und die öffentliche Widget-Ausgabe gesperrt.
- **Verbindungen → Follow-Events deaktivieren** ruft
  `POST /api/creator/twitch/follow-events/disable` auf: Die lokal
  vertrauenswürdige Subscription wird sofort deaktiviert und Followernamen
  werden gelöscht. Der Server versucht außerdem mit einem Twitch-App-Token
  `DELETE /helix/eventsub/subscriptions?id=...` auszuführen.
- Twitch antwortet im Erfolgsfall mit 204; eine bereits gelöschte Subscription
  (404) wird für erneute Bereinigungsversuche ebenfalls als erledigt
  behandelt. Bei Provider-Ausfall bleibt die Subscription **lokal widerrufen**
  und ihre ID für einen späteren Bereinigungsversuch gespeichert.
  Die Creator-Seite zeigt dafür „TWITCH-LÖSCHUNG ERNEUT VERSUCHEN“.
- Das Trennen der Twitch-Verbindung blockiert die lokale Event-Ausgabe und
  entfernt den OAuth-Zugang auch dann, wenn die externe Löschung gerade
  scheitert. Der noch offene providerseitige Bereinigungsauftrag bleibt
  mit `cleanup_pending` sichtbar und ist nach Anmeldung erneut ausführbar.
  Auch ein neuer Aktivierungsversuch muss ihn zuerst erfolgreich erledigen.
- Dieser zweistufige Ablauf verhindert, dass ein fehlgeschlagener
  Anbieter-Aufruf den Widerruf der lokalen Eventanzeige verhindert.
  Die reale providerseitige Löschung muss bei der Endabnahme nachgewiesen
  werden; ein CI-Mock beweist sie nicht.

## Ausstehende echte Abnahmetests

Mit einem autorisierten Twitch-Testkonto und einer zugänglichen Test-
Callback-Domain: OAuth-Berechtigung prüfen, Subscription anfordern,
Challenge und Status beobachten, einen echten Follow erzeugen, OBS-
Browser-Source sichtbar prüfen und bei Disconnect/Revocation die
providerseitige Subscription-Löschung nachvollziehen.

**Nicht** mit fiktiven Live-/Followerdaten als Beweis für eine echte
Providerverbindung arbeiten. Keine automatischen Produktionsdeployments
oder Datenbankänderungen aus CI-Tests ableiten.
