# Entwicklungsplan – Upload-Limit für Creator-Videos/Clips

**16.11.2026 · Folgebranch `fix/media-upload-item-quota-2026-11-16` auf PR-#95-HEAD `833123efd`.** PR #95 bleibt ungemergt.

| Priorität | Arbeitspaket | Status / Abnahme |
| --- | --- | --- |
| P1 | Angezeigte `500` Medien pro Ordner serverseitig prüfen | Implementiert in `src/media-quota.js`, Limits zentralisiert, bei 500 Einträgen `402 MEDIA_LIMIT_REACHED`. |
| P1 | Parallel-Uploads serialisieren und fehlerhafte Datenbankwerte blockieren | `accounts ... FOR UPDATE` mit COUNT und INSERT in einer Transaktion, keine Schemaänderung. Fail-closed bei unklarem COUNT. |
| P1 | Reject ohne verwaiste Dateien | `storeUploadWithRecord()` weiterverwenden, neue negative Unit-/Dateisystem-Tests in `scripts/test-media-quota.mjs`. |
| P1 | Echte HTTP-/PG18-Konkurrenz gegen Wegwerf-DB | Test im `scripts/test-account-creator-flow.mjs`: 499 Clips vorbereiten, 2 gleichzeitige Uploads, 201/402, Datei- und Folder-Prüfungen; `finally` räumt CI-Fixtures auf. |
| P1 | Vollständige CI und Review | **Code-/Test-HEAD `da488890` in vollständiger [CI 43780335660](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43780335660) `success`**. Den finalen Dokumentations-HEAD erneut prüfen. Folge-PR bleibt Draft bis Review und gesonderter Freigabe; kein Merge oder Deployment. |
| P0 unabhängig | Echte Render-Free-DB vor Ablauf sichern | [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) offen/gesperrt: Betreiberentscheidung Ziel 20.11., Dump Ziel 25.11., isolierter Restore Ziel 30.11., Ablauf 09.12.2026 18:36 UTC. |

**Gates:** Keine produktive DB-Abfrage, Dateilöschung, Migration, Render-Änderung, kostenpflichtige Dienstleistung, Deployment oder Merge. PR #95 hat eine eigene grüne CI, wird aber nicht ohne Freigabe gemergt. Nach PR-#95-Merge den Folge-PR bei Bedarf separat auf `main` umbasieren; unabhängig prüfen.

**Rücknahme:** Folge-Branch/Commits verwerfen bzw. nach separater Freigabe revertieren. Keine destruktiven Änderungen an bestehenden Medien.
