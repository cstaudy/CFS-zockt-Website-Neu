# Twitch EventSub — isolierte Signaturprüfung vor produktiver Freigabe

Dieses Teilpaket stellt in `src/twitch-eventsub-verification.js` ausschließlich reine
Vorprüfungsfunktionen bereit. **Es aktiviert weder einen Webhook-Endpunkt noch eine
Twitch-Subscription oder Datenbankmigration.** Es sendet keine Daten an Twitch und
legt keine Followerdaten an.

Die Funktionen:
- `eventSubConfigured()` akzeptiert nur ein serverseitiges, druckbares ASCII-
  Secret mit 32 bis 100 Zeichen. Twitch erlaubt grundsätzlich auch kürzere
  Secrets (ab 10 Zeichen); die Anwendung verlangt bewusst mehr Entropie.
- `readEventSubBody(req)` bewahrt die unveränderten Rohbytes, begrenzt die
  HTTP-Nachricht aber auf 64 KiB.
- `verifyEventSubMessage(headers,rawBody,secret,now)` verlangt einen
  aktuellen Nachrichtenzeitstempel (maximal 10 Minuten Abweichung), eine
  unterstützte `channel.follow`-Subscription Version 2 und einen korrekt
  formatierten, **konstantzeitlich verglichenen HMAC-SHA256** über
  `Message-ID + Timestamp + Original-Body`. Erst **nach** erfolgreichem
  Signaturvergleich wird JSON geparst.
- Signierte Notifications werden auf erwartete Broadcaster-/Moderator-IDs,
  Follower-ID und ein zeitlich plausibles `followed_at` geprüft. Signierte
  Challenges und Revocations werden gesondert validiert.
- Ein unpassender Signaturheader, abgelaufenes Event, ungültiger Body,
  ungeeignete Subscription oder nicht konfiguriertes Secret scheitert
  geschlossen. Keine Secrets oder Tokens erscheinen in Validierungsantworten.

**Die Prüfung allein verhindert keine Wiederholung innerhalb des
10-Minuten-Fensters.** Die vorgegebene DB-gestützte
`message_id`-Deduplikation und Zuordnung zu einem aktiv verknüpften,
einwilligenden Creator sind **nicht** Teil dieses Teilpakets. Vor einer
Live-Verarbeitung sind Migration 027, Account-/Subscription-Schutz,
widerrufbare lokale Ausgabe, Aufbewahrungsfrist, Rückruflogik, echtes
Testkonto und ausdrücklich autorisierte Produktionsfreigabe notwendig.
Ein öffentlicher `POST /api/webhooks/twitch/eventsub` wird hier **nicht**
registriert.

CI-Prüfungen umfassen Byte-exakte Signatur, manipulierte Headers,
Timestamp-Replay und Zukunftsabweichung, Größenlimits, Besitzeridentitäten,
Challenge/Revocation und fehlerhaftes JSON. Die bestehende PostgreSQL-CI
inklusive Legacy-Migrations- und isoliertem Restore-Lauf muss weiterhin
bestehen. Testdaten sind fiktiv und kein Beweis für eine produktive
Twitch-Verbindung. Kein manueller Render-Deploy oder produktives Backup-
Restore wird ausgelöst.
