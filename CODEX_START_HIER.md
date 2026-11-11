# CFS Zockt – sofort startbereites Codex-Arbeitsprojekt

Dies ist die **entpackte Website 3** – nicht nur eine Übergabe mit Anhängen. Die Website liegt direkt in dieser Wurzel (`index.html`, `server.js`, `package.json`, `pages/`, `assets/`, `src/`, `migrations/`).

## Mit Codex loslegen
1. ZIP entpacken und **diesen Projektordner** in Codex als Workspace öffnen.
2. Codex folgende kurze Nachricht geben:

> Bearbeite dieses Repository gemäß `AGENTS.md`, `CODEX_START_HIER.md` und `codex_handover/CODEX_AUFTRAG_KOPIEREN.md`. Beginne jetzt mit Phase 0 (Baseline/Tests), vergleiche die älteren Read-only-Archive in `_codex_sources/` selektiv, und setze danach nur sinnvoll fehlende Funktionen um. Die sechs Bilder unter `codex_handover/referenzbilder/` sind verbindliche Designreferenzen. Arbeite direkt am bestehenden Website-3-Code und dokumentiere Ergebnisse.

3. Codex prüft zuerst `npm ci`, `npm run check`, die weiteren im Projekt dokumentierten Befehle und führt erst dann sinnvolle lokale Start-/Integrationstests durch. `npm start` kann Datenbankmigrationen auslösen, wenn `DATABASE_URL` gesetzt ist – deshalb **keine produktive Datenbank** verbinden und keine automatischen Migrationen ohne Prüfung ausführen.

## Was liegt wo?
- `AGENTS.md`: automatisch auffindbare Hauptanweisungen für Codex
- `codex_handover/`: vollständiger Auftrag, Vergleichsbericht, Feature-Entscheidungsmatrix, sechs Referenzbilder, Logo, Hintergrund, Designkatalog
- `_codex_sources/website_main_alt.zip`: ältere alternative Architektur (nur Lesen)
- `_codex_sources/website_neu_alt.zip`: ältere NEU-Version (nur Lesen); identisches Duplikat `(1)` bewusst weggelassen
- Alle anderen normalen Projektordner/Dateien in der Wurzel: die aktuelle Website 3

## Bereitstellung und Sicherheit
- Nicht automatisch live deployed; dies ist ein lokales Arbeitsprojekt für Codex.
- Nur `.env.example` enthalten; echte Zugangsdaten separat in sicherer Umgebung konfigurieren.
- `node_modules` aus dem Quellarchiv absichtlich nicht mitkopiert; wiederherstellen via `npm ci`.
- Alte Archive nicht ungeprüft überschreiben; `.env`, produktive Datenbanken, Sessions und Accounts erhalten.
- Fehlende Original-Streamdesigns werden nicht vorgetäuscht.
