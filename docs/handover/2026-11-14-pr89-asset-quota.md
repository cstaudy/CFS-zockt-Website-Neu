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
