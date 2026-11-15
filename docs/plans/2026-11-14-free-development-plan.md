# Entwicklungsplan – kostenloser, sicherer Weiterbetrieb

Stand: 14.11.2026. Bezug: PR #89 und `main` ab `43f2ae1`.

## Leitplanken
Kein zusätzlicher Render-Tarif, kein neuer kostenpflichtiger Dienst, keine Produktionsmigration, kein Deploy ohne ausdrückliche Freigabe und bestätigten Restore. Arbeiten in kleinen Branches/PRs. Jede Änderung bekommt eine datierte Übergabe und einen aktualisierten Entwicklungsplan mit Status, Tests, Risiken und Rollback.

## Prioritäten

| Priorität | Arbeit | Nachweis / Abnahme | Status |
| --- | --- | --- | --- |
| P0 | Asset-Quota: eingehende Bytezahlen defensiv validieren | Unit-Negativfälle und CI des letzten PR-HEAD | Implementiert in PR #89; vollständige CI auf HEAD 5ab6de2 grün (Run 43631304250); abschließende Review vor Merge |
| P0 | Vorhandene Render-Produktions-DB nur lesend auf Migrationsstand prüfen | Kein Ledger / MFA-Challenges nachgewiesen, keine Schreibzugriffe | Blocker bestätigt |
| P0 | Reales verschlüsseltes Produktionsbackup und isolierter Restore durch autorisierten Betreiber | Wiederherstellung dokumentiert, keine Secrets im Repo | Blockiert: nicht nachgewiesen |
| P1 | Migrations- und Restore-Pfade kostenlos in GitHub Actions PostgreSQL 18 testen | `npm run check`, Creator-E2E, Legacy-Upgrade, Dump/Restore, Read-only Preflight | Vorhandene CI grün auf `main`; weiter bei jedem PR |
| P1 | Fehlerabbildung und Input-Grenzen der Upload-Routen prüfen | HTTP-Regressionstests, korrekte 4xx und keine Dateien/DB-Einträge bei Ablehnung | Fehlerabbildung und isolierter Quota-/Datei-Cleanup-Test ergänzt; anonymer HTTP-401-Test und authentifizierter HTTP-400-Leerupload-Test ergänzt; vorhandener PostgreSQL-18-E2E prüft bereits HTTP-402-Quota-Ablehnung mit Cleanup |
| P1 | Staging-Isolation nachweisen, bevor neue Builds auf Render starten | Separate Staging-DB ohne Produktionsverbindung | Blockiert: zweite Free-DB nicht erlaubt |
| P2 | Admin-Rollen/MFA-Entwürfe #47/#52 gesondert bewerten | Betreiberzugang, Backup, Restore, Rollback | Nicht mergen/deployen |
| P2 | Echte Browser-/OBS-/Launcher-/Integrationsabnahme | Dokumentierte Ergebnisse mit realen Berechtigungen | Noch nicht durchgeführt |

## Vorgehen je Aktualisierung
1. Aktuellen `main`- und PR-HEAD, CI und offene Blocker prüfen.
2. Kleine, isolierte Änderung mit Negativ- und Regressionstests erstellen.
3. Übergabe unter `docs/handover/` und Entwicklungsplan unter `docs/plans/` im selben PR aktualisieren.
4. Vollständige GitHub-Actions-CI abwarten; ohne grüne CI nicht mergen.
5. Keine Produktionsdatenbank/Render-Konfiguration ohne eigene Freigabe ändern.

## Nächster konkreter Schritt
1. PR #89 abschließend reviewen; Code, HTTP-Fehlerabbildung und Cleanup wurden geprüft. CI für HEAD `5ab6de2` ist grün (Run `43631304250`), GitHub meldet mergeable/clean. Merge nur nach ausdrücklicher Betreiberfreigabe; kein Deploy.
2. Release-Gates als unabhängiges Folgepaket vorbereiten: echten verschlüsselten Produktions-Dump und isolierten Restore durch autorisierten Betreiber nachweisen; kein Live-Zugriff durch CI oder diesen PR.
3. Vor dem 09.12.2026 eine kostenlose, nachweisbar datenverlustfreie Fortführungsentscheidung für Render-PostgreSQL treffen. Ohne bestätigten Restore keine Baseline 001–021, Migration 022–025 oder Produktionsstart.
4. Staging-DB-Trennung verifizieren, bevor irgendein Staging-Deploy erfolgt. Die bestehenden Staging-/Produktionsverbindungen nicht umkonfigurieren.

## Review-Befund PR #89 (14.11.2026)
- `assetQuotaViolation` prüft sichere nichtnegative Ganzzahlen vor BigInt-Quota-Arithmetik; `registerAssetWithinQuota` lehnt fehlerhafte Größen vor DB-Verbindung mit HTTP 400 ab.
- HTTP-Upload validiert Body-Größe und PNG-Signatur vor Dateischreibzugriff; Fehlercodes 400/401/402/413/415 sind in Unit- und HTTP-Tests abgedeckt.
- E2E mit Wegwerf-PostgreSQL 18 prüft Quota-Transaktionen, Rollback, Dateibereinigung sowie unveränderte Asset-Anzahl nach abgelehnten Grenz-Uploads.
- Keine Produktionsmigrationen, keine neuen Tabellen, keine Render-Konfigurationsänderungen. Bestehende Release-Blocker bleiben bestehen.
