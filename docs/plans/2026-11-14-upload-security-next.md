# Entwicklungsplan – Upload-Auslieferung und sichere Releases

Stand: 14.11.2026. Kostenrahmen: nur bestehende GitHub-Actions-CI, keine neue kostenpflichtige Render-Datenbank.

| Priorität | Aufgabe | Status / Nachweis |
| --- | --- | --- |
| P0 | Upload-Auslieferung: `nosniff` für alle Dateiendungen | Implementiert auf diesem Branch, CI für HEAD noch prüfen |
| P0 | Creator-Quota-Eingaben absichern | PR #89, CI grün, Draft nicht gemerged |
| P0 | Produktions-Backup und isolierten Restore nachweisen | Blockiert, kein echtes Backup bestätigt |
| P0 | PostgreSQL-Migrationshistorie/Legacy-Baseline klären | Produktions-DB ohne Ledger, keine Schreibzugriffe freigegeben |
| P1 | Upload-Header in realen Browsern und bei Altdateien prüfen | Offen; Unit-Test ersetzt Browserprüfung nicht |
| P1 | Isolierte PostgreSQL-18-Migrationstests in GitHub Actions weiterführen | Vorhandene CI, bei jedem PR erneut prüfen |
| P2 | Render-Staging nur mit unabhängiger DB | Blockiert: zweite kostenlose Render-DB abgelehnt |

## Vorgehen und Rollback
Nach jedem Code-Update Übergabe + Entwicklungsplan im selben Branch, CI des letzten HEAD prüfen, nur nach Review mergen. Keine Produktionsmigration, kein Render-Deploy, kein zusätzlicher Tarif. Bei Browserregression den kleinen Header-Commit revertieren. Als nächste Aufgabe die tatsächliche Header-Anwendung in der HTTP-Auslieferung und den Testumfang prüfen.

## Nachprüfung des bestehenden PR #90
- HEAD `2b328c7` erfolgreich in GitHub Actions (Run `43625825079`), ohne Merge-Konflikte. Reine Headerhärtung, kein Datenbankzugriff.
- Review kann beginnen; kein Merge ohne ausdrückliche Freigabe. Browser-E2E bleibt optionaler, vor Deployment nachzuholender Nachweis.

## Review-Gate PR #90
- CI für `5dbfbeb` grün (Run `43638853771`); PR #90 jetzt review-bereit.
- Offene Abnahme: Reviewer bestätigt Headerverhalten; realer Browser-Test vor Deployment; explizite Mergefreigabe bleibt erforderlich.
- Nach dieser Dokumentationsänderung neue CI prüfen. Keine weiteren Änderungen ohne Befund.

## Nächste Abnahme: tatsächlicher HTTP-Uploadpfad
- Quellcode verifiziert: `server.js` nutzt `uploadDeliveryHeaders(filePath)` bei `res.writeHead(200)` für Uploads, für GET und HEAD.
- Bestehender HTTP-Test prüft `401` für anonyme Uploads, aber noch keinen authentifizierten `200`-Response mit `nosniff` und Legacy-`attachment`.
- Vor produktivem Deployment in isolierter Testumgebung mit Test-DB und Auth-Fixture HTTP-Header für Bild/Video/Legacy jeweils mit GET und HEAD prüfen. Kein Zugriff auf Prod-Daten, keine Freigabe durch grünen Unit-Test allein.
- PR #90 HEAD `bb56976` CI grün (Run `43639049229`); neue reine Dokumentations-CI prüfen.

## Isolierter HTTP-200-Test – Voraussetzungen
- `serveStatic()` lässt Upload-HTTP-200 nur nach DB-gestützter Veröffentlichung oder Eigentums-/Authentifizierungsprüfung zu. Ohne Test-DB ist der sichere Integrationstest nicht realisierbar; Autorisierung keinesfalls lockern.
- Testplan: ephemeres PG18 mit Migrationsschema; eigenes Testkonto, Session und Asset-Datei; GET/HEAD auf bekanntes Bild und Legacy-Datei; `nosniff`, MIME, `attachment`, `private, no-store` und Fremdzugriff prüfen; danach DB und Dateien entsorgen.
- Aktueller HEAD `088d8b0` CI grün (Run `43639293520`); keine Änderung an Auth-Logik oder Produktionsinfrastruktur.

## HTTP-Header-Test in bestehende kostenlose CI integriert
- Bereits vorhandene PG18-CI führt echte authentifizierte HTTP-GET/HEAD-Tests mit Testkonto und Testdateien aus; Legacy-`.html` wurde schon mit `nosniff`/`attachment` geprüft. Vorherige Beschreibung als komplett fehlender HTTP-200-Test korrigiert.
- Ergänzt: `scripts/test-account-creator-flow.mjs` prüft für normale Bild-/Video-Uploads nun auch `nosniff` und erwarteten MIME auf GET/HEAD (Commit `6a661eb`).
- Nächster Gate: neuer CI-Lauf muss grün sein; manueller Browser-Test vor Produktionsfreigabe bleibt offen. Kein Merge/Deploy ohne Freigabe.

## CI-Abnahme: authentifizierte Upload-Header
- HTTP-Regression für Bild/Video GET+HEAD (`6a661eb`) in GitHub Actions `43639925962` **erfolgreich**, inklusive ephemerem PG18.
- Bestehende Legacy-`.html`-GET/HEAD-Tests sichern `nosniff`, `attachment` und binäre Auslieferung ab.
- Noch offen: Review-/Mergeentscheidung und manueller Browser-Test vor Deployment. Der nachfolgende Dokumentations-HEAD benötigt ebenfalls erfolgreiche CI.

## Abhängigkeiten zwischen den drei review-bereiten PRs
- #89 und #90 berühren beide `scripts/test-account-creator-flow.mjs`, jedoch verschiedene Abschnitte. Zusammenführbarkeit muss nach **jedem** autorisierten Merge durch neue CI auf `main` nachgewiesen werden; Einzel-PR-Grün allein genügt nicht.
- #91 fügt Dokumentations-/Release-Gates und `npm run check`-Guard hinzu; kein direkter Dateiüberschneidungsbefund mit #89/#90.
- Alle drei PRs auf aktuellem Stand clean und grün (#90 `502625f`, CI `43640019169`). Keine Reihenfolge ist freigegeben; ohne ausdrückliche Zustimmung kein Merge.
