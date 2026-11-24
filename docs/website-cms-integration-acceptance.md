# Website CMS integration acceptance

Status: HOLD – no production activation.

## Local verification (no production credentials)
Use a clean checkout of development/website-community, Node 22 and a shell without production environment variables.
```sh
npm ci --ignore-scripts
env -u DATABASE_URL -u SESSION_SECRET npm run check
```
Record commit SHA, Node version, exit status and failing test output. Check GitHub Actions separately.

## Integration order
1. Confirm existing authentication and server-side elevation contract. Never accept elevation from request JSON.
2. Agree database schema with migration owner. Use isolated PostgreSQL only; do not modify existing migration files.
3. Implement transactional repository: load trusted state and media, lock media consistently, compare revision, write draft/published/history atomically, return only after commit.
4. Add admin read/mutation routes with existing origin checks and authorization; public read returns published projection only.
5. Add dedicated media GET/HEAD with trusted storage resolution, signature validation, no-store and uniform 404. Do not widen existing upload permissions.
6. Wire browser adapter only after route acceptance; validate CSP, fallback, original logo and responsive layout.
7. Test two concurrent editors, transaction failure, revoked media, cross-account access, restore, deletion races and independent widget publication.
8. Verify actual browser on desktop and iPhone, then request explicit release approval.

## Evidence required
- Full npm check output and commit SHA.
- Isolated DB migration and rollback/restore evidence.
- Real HTTP authorization and concurrent transaction tests.
- Browser screenshots and CSP console results.
- Explicit operator approval before deployment.

Existing isolated assertions are not a substitute for these gates.

## HTTP-Integration: sichere Vorstufe
server.js enthält nun GET/HEAD /api/public/website-design mit design:null und no-store; /api/admin/website-design prüft requireAdmin und antwortet danach 503 WEBSITE_DESIGN_NOT_CONFIGURED. Keine Mutation, kein DB-Speicherzugriff außer bestehender Authentifizierung, kein Browser-Fetch. Bestehende Elevation liefert weiterhin active:false/available:false. Quellcodeänderung gespeichert, echte HTTP-/Node-Abnahme ausstehend. Vor Merge server.js mit staging-site-content-Branch abgleichen (gemeinsame Datei).

## Admin-Verfügbarkeitsanzeige – cf29326 / 14c5a53
Lokale Designvorschau fragt nach erfolgreicher Admin-Summary GET /api/admin/website-design ab. 503 zeigt fehlende Einrichtung, 401/403/428 gesperrten Zugriff, sonst Fehlerstatus; auch Erfolg aktiviert keine Schreibfunktionen. Separates aria-live Statusfeld, lokale Bildvorschau bleibt unabhängig. JS-Syntax im Isolate geprüft; Mock-Harness angepasst, noch nicht ausgeführt. Vollständige Node-/HTTP-/Browser-Abnahme offen. Keine DB-/Auth-Änderung.
