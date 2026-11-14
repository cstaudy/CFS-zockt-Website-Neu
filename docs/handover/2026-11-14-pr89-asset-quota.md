# Übergabe – PR #89: Creator-Asset-Größenprüfung

Stand: 14.11.2026. Branch: `security/asset-quota-invalid-size-guard-2026-11-14`.
Basis: `main` bei `43f2ae1b5d4d3b5c0e7ed5eef9e7d1acf0444a88`.
PR: https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89

## Ziel und Änderung
Defensiv absichern, dass eingehende Asset-Bytezahlen vor Quota-Arithmetik und Datenbankverbindung gültige, nichtnegative, sichere JavaScript-Ganzzahlen sind. Keine Änderung des Limits von 120 Assets / 128 MiB.

- `src/asset-quota.js`: `assetQuotaViolation()` liefert `INVALID_ASSET_SIZE` für ungültige eingehende Größen; `registerAssetWithinQuota()` antwortet mit Status 400 vor `pool.connect()`.
- `src/assets.js`: mappt den zusätzlichen internen Fehlercode `INVALID_ASSET_SIZE` auf die bestehende strukturierte HTTP-400-Antwort, statt einen ungefangenen Fehler zu erzeugen.
- `scripts/test-asset-quota.mjs`: Negativfälle (negative, gebrochene, nichtendliche, String-, null-, undefined- und unsichere Zahlen) und Prüfung, dass kein SQL ausgeführt wird.

## Testnachweis
GitHub Actions, PR-HEAD `7659fce9792ba3cd689a689ea8fd46d16ba8f9f5`: erfolgreich am 14.11.2026.
https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43624191572
Nach weiteren Code- und Dokumentationsänderungen CI erneut prüfen; obiger Nachweis gilt nur für den genannten Commit. Die HTTP-Abbildung ist defensiv und noch nicht durch einen eigenen End-to-End-HTTP-Test abgedeckt.

## Betriebsstatus und Risiken
- Kein Merge, kein Render-Deploy, keine Produktionsdatenbankmutation.
- Produktionsdienst `CFS-TikTok-Backend` zuletzt nachgewiesen auf `3f8c46e`; Staging `cfs-zockt-staging` auf `0c5a0ea`, Auto-Deploy jeweils aus.
- Staging hat keine nachgewiesene unabhängige DB; Render erlaubt im Workspace keine zweite aktive kostenlose Postgres-Instanz.
- Produktions-Postgres 18.6 enthält `accounts`, aber keine `schema_migrations` und keine `mfa_login_challenges` (Read-only-Prüfung vom 14.11.2026).
- Reale Backup-/Restore-Abnahme fehlt. PostgreSQL-18-CI nutzt isolierte Testdaten, nicht den Produktionsdatenbestand.
- `INVALID_ASSET_SIZE` ist ein zusätzlicher interner Fehlerpfad; gültige Uploads bleiben unverändert. Aufrufende Upload-Pfade und Fehlerabbildung bei späteren Änderungen erneut testen.

## Rollback und Übernahme
Bei Regression PR nicht mergen bzw. die Code-/Test-Commits revertieren; keine Schema-Rückmigration erforderlich. Vor Merge die CI des letzten PR-HEAD, den Diff und die API-Fehlerabbildung prüfen. Produktionsfreigabe bleibt separat und erfordert echte Backup-/Restore-Abnahme.

## Aktualisierung: Quota-Ablehnung und Dateiaufräumung
Am 14.11.2026 wurde `scripts/test-asset-quota.mjs` um einen isolierten Integrationstest ergänzt: Der Test schreibt über `storeUploadWithRecord()` eine temporäre Datei, simuliert die Ablehnung bei 120 Assets bzw. überschrittenem Byte-Limit und prüft anschließend Datenbank-Rollback und leeres temporäres Upload-Verzeichnis. Kein Produktionszugriff. Commit `628c9bd`.

Dieser Test ist **kein echter HTTP-End-to-End-Test**. Für den aktuellen Commit steht der CI-Nachweis noch aus; ältere grüne Läufe gelten nicht als Nachweis für diesen Commit.

## Aktualisierung: anonymer HTTP-Upload
Commit `789e6f9` ergänzt im bestehenden Server-HTTP-Test `scripts/test-static-boundary.mjs` einen POST auf `/api/creator/widget-studio/assets` ohne Sitzung. Erwartet werden HTTP 401 und `AUTHENTICATION_REQUIRED`; das temporäre Upload-Verzeichnis darf keine neue Datei enthalten. Test startet lokalen Node-Server ohne `DATABASE_URL`, keine Render- oder Produktionszugriffe. **Kein authentifizierter HTTP-Quota-Test**; der Quota- und Cleanup-Pfad wird separat im isolierten Test geprüft. CI für den neuen Commit steht aus.

## Aktualisierung: authentifizierter HTTP-400-Test
Commit `73de312`: `scripts/test-account-creator-flow.mjs` prüft mit angemeldetem CI-Testkonto auf der lokalen PostgreSQL-18-Datenbank einen leeren Bild-POST. Erwartet werden HTTP 400 / `INVALID_ASSET_SIZE`, unveränderte Anzahl von `creator_assets` und unverändertes Upload-Verzeichnis. Der vorhandene CI-E2E-Test prüft bereits authentifizierte 402-Ablehnungen für Asset-Anzahl und Speicherlimit einschließlich Cleanup; dies wurde bei der Bestandsaufnahme bestätigt. Keine Produktionsdaten. CI für den aktuellen PR-HEAD nach Dokumentations-Commits erneut prüfen.

## CI-Fehleranalyse und Testkorrektur
GitHub Actions Run `43628319038` scheiterte im PostgreSQL-E2E an `ENOENT` beim `readdir(assets/uploads)` in der neu eingefügten Leerupload-Prüfung. Das Verzeichnis existiert bei frischer CI-Installation noch nicht. Commit `ed7bb5a` ergänzt `uploadFilesIfPresent()`: `ENOENT` zählt als leeres Verzeichnis, andere Dateisystemfehler werden weitergeworfen. Die Korrektur betrifft ausschließlich den Test; keine Laufzeitcode-Änderung. CI des neuen HEAD ist erneut abzuwarten.

## Aktualisierung: HTTP 413 für zu große Asset-Uploads
Der vorherige HEAD `b0cb3cb` ist in GitHub Actions Run `43629217715` vollständig grün. Commit `f81cbca` ergänzt `scripts/test-static-boundary.mjs`: POST auf die Asset-Upload-Route mit 16 MiB + 1 Byte und korrektem Content-Length muss HTTP 413 / `PAYLOAD_TOO_LARGE` liefern, ohne Upload-Datei zu schreiben. Test verwendet lokalen Server ohne Datenbank. CI für den neuen HEAD ist noch offen. Chunked-413 ist bereits in `scripts/test-request-raw.mjs` für den Stream-Parser abgedeckt; eine vollständige HTTP-Routenprüfung für Chunked-Uploads bleibt als separates Ziel bestehen.
