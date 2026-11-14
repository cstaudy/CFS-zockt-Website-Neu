# Stream Maker: signed public OBS browser source

The existing `/widgets/stream-maker.html?token=<signed-token>&element=<element-id>` now has its previously missing JavaScript and stylesheet. The anonymous GET `/api/public/stream-maker/<signed-token>` accepts only an exact HMAC-SHA256 capability derived from the server `SESSION_SECRET`, the bundle UUID and a revocable stored token revision. The signature is compared using constant-time byte comparison; a bare UUID, malformed token, modified signature, missing secret or archived bundle is a 404.

**Security and consent:** An OBS source token is effectively a *bearer credential*. Anyone with the full URL can see the visual text and settings intentionally included in that Stream-Maker bundle. Treat that URL as shareable output, not as a private document link. Do not put passwords, account IDs, hidden Creator drafts, or other secrets into visual text fields intended for the public. The API returns only the validated/sanitized visual configuration. No session cookies, account metadata, auth tokens, raw project records, shop publication or provider data are sent to the browser.

The source sanitizer rejects arbitrary external image URLs and private `/assets/uploads/` paths. Only built-in first-party design sources currently survive validation. Private creator media is never made publicly accessible through this PR. No `/assets/uploads` source-token exception is introduced.

**Revocation:** Rotating a bundle's source token invalidates older signed URLs. Archiving a bundle invalidates every source immediately. A current OBS Browser Source that receives a permanent 404 clears its canvas and in-memory model. The separate one-second render timer cannot redraw a stale/revoked frame. If a formerly selected element is removed, the browser clears that element without continuing to show outdated content. Public responses are no-store, and the browser fetches without session cookies.

**Bearer-URL-Härtung:** Die HTML-Ausgabe
`/widgets/stream-maker.html?token=…&element=…` sendet
`Referrer-Policy: no-referrer` (zusätzlich als HTML-Metatag),
`Cache-Control: no-store` und `X-Robots-Tag: noindex, nofollow, noarchive`.
Damit wird die Token-URL nicht als Referer bei nachgeladenen CSS-/JS-/Bild-
Ressourcen oder nachfolgenden Navigationen übertragen. Dieselben Regeln
gelten auch für HEAD-Antworten. Die öffentlichen statischen CSS-/JS-Dateien
bleiben weiterhin normal cachebar und der bereits private API-Output
bleibt `no-store`.

Die signierte JSON-API `/api/public/stream-maker/<signed-token>` trägt
ab jetzt dieselben Referer-/Robots-Schutzheader, **auch auf 404-Antworten**
und bei HEAD-Aufrufen: `Referrer-Policy: no-referrer`,
`X-Robots-Tag: noindex, nofollow, noarchive`,
`Cache-Control: no-store`. Bei Browsernavigation auf diese
Capability-URL dürfen weder die vollständige Quelladresse noch die
Signatur über einen nachfolgenden Referer weitergegeben werden.
Das API-Payload und das vorhandene Token-Berechtigungsmodell bleiben
unverändert.

**Rest-Risiko:** Das signierte Token steht weiterhin in der vollständigen
OBS-Quelladresse und im API-Pfad; es kann deshalb im Browser-Quellkonfigurations-
dialog, in Bildschirmaufnahmen, Reverse-Proxy-/Access-Logs oder von
Personen mit direktem URL-Zugriff bekannt werden. HTTP-Header beseitigen
dieses Risiko **nicht**. Niemals Secrets als Overlaytext eingeben,
Quelladressen nicht öffentlich teilen und bei Verdacht den Token rotieren.
Dieser PR verändert die Token-Erteilung und Widerrufsfunktion nicht.

**Not activated:** Maker Shop publication, cross-account template copying, uploader-based public assets, Twitch EventSub, migration 026/027 and admin-role changes. A real OBS Browser Source, Render auto-deploy settings and production backup/restore still require independent operator acceptance.

Release gates: pure browser simulation of revoked token and deleted element, sanitization/URL tests, PostgreSQL HTTP E2E with two owners, token tampering, public counter updates, signed token rotation and archive, plus all existing isolated PostgreSQL migration and restore CI.
