# Stream Maker: signed public OBS browser source

The existing `/widgets/stream-maker.html?token=<signed-token>&element=<element-id>` now has its previously missing JavaScript and stylesheet. The anonymous GET `/api/public/stream-maker/<signed-token>` accepts only an exact HMAC-SHA256 capability derived from the server `SESSION_SECRET`, the bundle UUID and a revocable stored token revision. The signature is compared using constant-time byte comparison; a bare UUID, malformed token, modified signature, missing secret or archived bundle is a 404.

**Security and consent:** An OBS source token is effectively a *bearer credential*. Anyone with the full URL can see the visual text and settings intentionally included in that Stream-Maker bundle. Treat that URL as shareable output, not as a private document link. Do not put passwords, account IDs, hidden Creator drafts, or other secrets into visual text fields intended for the public. The API returns only the validated/sanitized visual configuration. No session cookies, account metadata, auth tokens, raw project records, shop publication or provider data are sent to the browser.

The source sanitizer rejects arbitrary external image URLs and private `/assets/uploads/` paths. Only built-in first-party design sources currently survive validation. Private creator media is never made publicly accessible through this PR. No `/assets/uploads` source-token exception is introduced.

**Revocation:** Rotating a bundle's source token invalidates older signed URLs. Archiving a bundle invalidates every source immediately. A current OBS Browser Source that receives a permanent 404 clears its canvas and in-memory model. The separate one-second render timer cannot redraw a stale/revoked frame. If a formerly selected element is removed, the browser clears that element without continuing to show outdated content. Public responses are no-store, and the browser fetches without session cookies.

**Not activated:** Maker Shop publication, cross-account template copying, uploader-based public assets, Twitch EventSub, migration 026/027 and admin-role changes. A real OBS Browser Source, Render auto-deploy settings and production backup/restore still require independent operator acceptance.

Release gates: pure browser simulation of revoked token and deleted element, sanitization/URL tests, PostgreSQL HTTP E2E with two owners, token tampering, public counter updates, signed token rotation and archive, plus all existing isolated PostgreSQL migration and restore CI.
