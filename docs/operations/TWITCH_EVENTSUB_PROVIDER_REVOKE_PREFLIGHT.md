# Twitch EventSub — vorbereitete Provider-Löschung mit App-Token

In dieser zweiten, getrennt testbaren Vorbereitung wird ausschließlich
`deleteRemoteFollowSubscription(subscriptionId)` bereitgestellt. Die
Funktion ist **noch an keine produktive Route angeschlossen** und wird
nicht automatisch ausgeführt. Ein Import allein führt keinen Netzwerkaufruf
und keine Datenbankänderung aus.

Vorgesehene Verwendung nach späterer freigegebener Migration 027:
- Subscription-ID strikt als UUID prüfen, bevor eine Anfrage möglich ist.
- Ausschließlich das **serverseitige App-Access-Token** via
  `client_credentials` für den Twitch-Webhooks-Endpunkt beziehen, nicht
  den OAuth-User-Token eines Creators.
- Nur feste Twitch-Domains verwenden: `id.twitch.tv` und
  `api.twitch.tv/helix/eventsub/subscriptions?id=...`.
  Jede Anfrage ist auf sieben Sekunden begrenzt. Keine Credentials in
  Rückgaben oder Protokollmeldungen.
- Nur HTTP **204** bestätigt in diesem konservativen Vorbereitungsmodul
  die providerseitige Löschung.
- HTTP **404** kann laut Twitch sowohl „Subscription nicht vorhanden“
  **als auch „mit anderem Token/Client erstellt“** bedeuten.
  Deshalb antwortet die Funktion mit
  `{deleted:false,reason:"provider_not_found_or_not_owned"}`;
  die spätere Anwendung muss den lokal widerrufenen Zustand bewahren und
  den providerseitigen Reconciliation-Fall gesondert bearbeiten.
  404 wird bewusst **nicht** als sichere Remote-Löschung ausgegeben.
- 401, 500, Provider-Ausfälle, Netzwerkfehler und fehlende Konfiguration
  liefern ebenfalls **kein** `deleted:true`.

**Wichtig:** Spätere Widerrufslogik muss lokale Followerdaten und öffentliche
Ausgaben unabhängig vom Twitch-Provider sofort sperren. Providerfehler
dürfen Einwilligungsentzug niemals blockieren. Dieser Helfer implementiert
weder lokale Widerrufsoperationen noch Twitch-Subscription-Erstellung,
Webhook-Empfang, Follower-Speicherung oder Bereinigung. Diese Schritte
bleiben Migration 027 und der autorisierten Betreiberfreigabe vorbehalten.

Die CI verwendet ausschließlich gemockte Twitch-Antworten, inkl.
App-Token-Abruf, 204, 404, 401, 500, fehlender Konfiguration,
Netzwerkausfall und später erfolgreich wiederholtem Löschversuch.
Keine echten Twitch-Zugangsdaten oder Anbieter-Requests in der CI.
Reales Twitch-Testkonto, Callback-Domain, Prod-Backup/Restore und
Rollback sind weiterhin nicht verifiziert. Kein manueller Deploy.
