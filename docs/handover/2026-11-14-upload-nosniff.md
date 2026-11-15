# Übergabe – PR #90: Upload-Auslieferung ohne MIME-Sniffing

**Stand:** 15.11.2026 · **Branch:** `security/upload-delivery-nosniff-2026-11-14` · **PR:** [#90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) (Ready for review, offen, ungemergt).

## Zweck und tatsächliche Änderungen

- `src/upload-media-policy.js`: `uploadDeliveryHeaders()` setzt `X-Content-Type-Options: nosniff` für bekannte Bild-/Video-Endungen **und** unbekannte Legacy-Endungen. Unbekannte Uploads bleiben `application/octet-stream` mit `Content-Disposition: attachment; filename="download"`; vom Uploader gelieferte Dateinamen werden nicht gespiegelt.
- `scripts/test-upload-media-policy.mjs`: Unit-Regressions für MIME, `nosniff` und sichere Behandlung unbekannter Erweiterungen.
- `scripts/test-account-creator-flow.mjs`: echte HTTP-GET-/HEAD-Regressions mit isoliertem PostgreSQL 18 aus der bestehenden CI, ohne Authentifizierungs-Bypass. Die Autorisierungslogik und produktiven Routes bleiben unverändert.
- Keine neue DB-Migration, keine neuen Kosten und keine Änderung an Render-Konfiguration, Produktion oder Secrets.

## HTTP-Testmatrix und Sicherheitsinvarianten

| Fall | GET und HEAD | Zusätzliche Zusicherung |
| --- | --- | --- |
| Eigenes privates Bild/Video | Eigentümer `200`; anonym `401`; fremder Creator `404` | Bei `200`: `private, no-store`, `nosniff`, validierter MIME, unveränderte GET-Bytes; sonst `no-store` + `nosniff` |
| Veröffentlichtes OBS-Bild | Anonym `200` | `image/png`, `nosniff`, `private, no-store`, Originalbytes |
| Separates privates Video bei öffentlichem Bild | Anonym `401` | Keine indirekte Freigabe über OBS; `no-store`, `nosniff` |
| Eigener unveröffentlichter Entwurf / fremde Widget-Referenz | Anonym `401` | GET/HEAD, `no-store` |
| Bild nach `published → private` | Anonym `401`, Eigentümer `200` | Widerruf sofort; Eigentümerbytes bleiben intakt; korrekte Header |
| Fremder Video-Löschversuch | `DELETE 404`; Besitzer-GET/HEAD bleiben `200` | Datei und Originalbytes bleiben intakt |
| Eigentümer löscht Video | Datei entfernt; anonym `401`, fremd und Eigentümer `404` | GET/HEAD mit `no-store` und `nosniff`; wiederholtes DELETE bleibt `404` und stellt nichts wieder her |
| Nicht vorhandene private Upload-URL | Anonym `401`, angemeldet ohne Zuordnung `404` | GET/HEAD; `no-store` und `nosniff` |
| Bestehender gefährlicher Legacy-Upload (`.html`, **neu `.svg`**) | Eigentümer `200`, anonym `401` | GET/HEAD `application/octet-stream`, festes `attachment`, `nosniff`, `private, no-store`, unveränderte GET-Bytes |

**Ableitung der Fehlercodes:** `server.js:serveStatic()` prüft bei Uploads öffentliche, exakt referenzierte Eigentümerprojekte, andernfalls Authentifizierung (`401`) und Asset-Eigentum (`404`). `json()` setzt `no-store` und `nosniff`. Die Tests prüfen dieses bestehende Verhalten, nicht eine neu eingeführte Policy.

## Aktueller Nachweis / Änderungen dieser Runde

- Letzter **vollständig grüner Branch-HEAD vor dieser Runde**: `da0ff0b`, GitHub Actions [43707471165](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43707471165) **success**. Testcommit `83de4fe` für unbekannte Uploads ebenfalls **success** ([43707456878](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43707456878)).
- **Neuer Testcommit `6cd18e0` (CI noch zu prüfen):** Vorhandene historische `.html`-HTTP-Fixture zu `.html` **und** `.svg` ausgeweitet, inklusive anonymer GET-/HEAD-Sperre, exaktem festen Download-Dateinamen, Bytevergleich und Aufräumen in `finally`. Es wird ausschließlich die ephemere Testumgebung genutzt.
- Diese Übergabe und der Entwicklungsplan wurden zur Reviewer-Nutzung von chronologischen Zwischenständen in aktuelle Nachweise, Matrix und Freigabeschritte konsolidiert. Vergangene Commit-Details bleiben im Git-Verlauf erhalten.

## PR-Überlappung und Review

- [PR #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) ist eigenständig offen/grün; ergänzt `scripts/test-account-creator-flow.mjs` um Basiszeile 772. #90 ergänzt dieselbe Datei ab Basiszeile 887: **keine Überschneidung der beobachteten Patch-Hunks**, aber **kein Beweis für kombinierte CI**.
- [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) ist offen/grün; Release-/Backup-Gates und eigene Offline-Prüfung, nach Dateidiff keine Überschneidung mit #89/#90.
- Reviewer sollten MIME-Header, Legacy-Download statt Ausführung, tatsächliche OBS-Darstellung und Auswirkungen auf bestehende Browser prüfen. `nosniff` kann falsch klassifizierte Bestandsdateien absichtlich blockieren.

## Offene Gates / Weitergabe

1. CI auf **Codecommit `6cd18e0` und anschließendem Dokumentations-HEAD** prüfen; bei Fehlern in der Test-Fixture korrigieren.
2. PR #90 technisch reviewen und in einer sicheren Testumgebung Browser-/OBS-Prüfung durchführen. HTTP-E2E ersetzt keine Browserabnahme.
3. **Nur nach expliziter Mergefreigabe:** Änderungen integrieren, kombinierte CI auf aktualisiertem `main` für #89/#90/#91 erneut nachweisen.
4. **Kein Produktionsdeploy**, solange echtes verschlüsseltes Produktionsbackup, isolierter Restore, belegte Staging-DB-Isolation und Migrations-/Baseline-Freigabe fehlen. Siehe `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md` aus PR #91; kostenlose Render-PostgreSQL läuft voraussichtlich am **09.12.2026** aus, Fortsetzung nicht bestätigt.
5. Rollback: PR ungemergt lassen; nach autorisiertem Merge den kleinen Header-Commit revertieren, falls ein unerwartetes Browserproblem auftritt. Keine produktiven Daten ohne separate Freigabe ändern.

## 16.11.2026 – Integration nach PR #89, vor Merge

- [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) und [PR #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) wurden per Nutzerfreigabe bereits in `main` gemergt. Main-Commit nach #89: `336427d283eba2660f53c648c48b87b0208d601e`, [CI 43774832762](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43774832762) **success**.
- Der PR-#90-Branch wurde auf diesem neuen Main-Basisstand mit einem gezielten Integrationscommit abgeglichen, wobei sowohl die Upload-/Quota-E2E-Fälle aus #89 als auch die `nosniff`-GET/HEAD-Regressionsfälle aus #90 in `scripts/test-account-creator-flow.mjs` erhalten bleiben. Separater [Draft-Integrationstest #94](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/94) für #89+#90+#92 bestand [CI 43766460488](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43766460488) und wurde **ohne Merge geschlossen**.
- Die finale #90-Branch-CI muss nach diesem Sync neu **success** melden, bevor #90 separat gemergt wird. [PR #92](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/92) (`Object.hasOwn`) bleibt zunächst separat; #90 führt dessen Code noch nicht ein.
- Keine Änderung an Render, Produktion oder Datenbank, kein Deployment, kein bezahlter Dienst. Echtes Backup/Restore aus [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) weiterhin **OFFEN/GESPERRT**.
