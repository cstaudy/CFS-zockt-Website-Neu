# Übergabe – PR #92 Upload-MIME-Lookup auf eigene Mapping-Schlüssel begrenzen

**Stand:** 15.11.2026 · **Pull Request:** [#92](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/92) · **Branch:** `fix/upload-mime-own-keys-2026-11-15` · **Status:** Code zur Review, noch **nicht** gemergt.

## Ausgangspunkt nach PR #91

- [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) wurde mit ausdrücklicher Nutzerfreigabe **per Squash** in `main` gemergt: Commit `a4e3daacb145bd533a41b6a6cf54e42c02f74e64`. Die anschließende [Main-CI 43756711273](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43756711273) ist **success**. Der Merge war **kein Deployment**; die produktive PostgreSQL-Datenbank wurde nicht verändert.
- Das [P0-Betreiber-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) bleibt **OFFEN**: echte verschlüsselte Datensicherung, isolierter Restore, kostenlose Fortführung und Staging-Trennung sind noch nicht belegt. Render-Free-DB-Ablauf laut Read-only-Befund **09.12.2026, 18:36:16 UTC**.
- Der bestehende Branch von PR #92 war nach #91 veraltet. Ein kontrollierter Merge von `main` in den PR-Branch erfolgte durch Commit `cd2ba738619f8566a32154889a617d05b3e9a4d8`, wobei **nur die beiden Upload-MIME-Dateien** als PR-Diff erhalten blieben. Vor den neuen Codeänderungen war der Branch **0 Commits hinter main**, [CI 43756941671](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43756941671) **grün**.

## Sicherheitsproblem und Korrektur

1. `src/upload-media-policy.js`: Die MIME-zu-Speicher-Endung-Tabelle ist ein gewöhnliches JavaScript-Objekt. `uploadExtensions[mime]` konnte ererbte Schlüssel von `Object.prototype` (z. B. `constructor`, `toString`, `__proto__`) fälschlich als unterstützte Upload-Typen behandeln. **Fix:** `Object.hasOwn(uploadExtensions, mime)` vor Rückgabe der Speicherendung.
2. Dieselbe Klasse von Problem betrifft das **Auslieferungs-Mapping** `deliveryTypes`: Bei einer anderweitig verursachten Prototype-Pollution wie `Object.prototype[".svg"] = "image/svg+xml"` dürfte eine ältere `.svg`-Datei nicht als aktives gleichursprüngliches Dokument ausgeliefert werden. **Fix:** `Object.hasOwn(deliveryTypes, extension)`; unbekannte Endungen bleiben `application/octet-stream` mit `attachment; filename="download"`.
3. `scripts/test-upload-media-policy.mjs`: Prüft alle acht erlaubten MIME-Typen weiterhin positiv; verwirft geerbte Standard-Objektschlüssel; simuliert außerdem **kontrolliert** ererbte `.svg`-/`.html`-Auslieferungs-MIME-Typen und einen fremden Upload-MIME-Schlüssel. Die Testdatei stellt geänderte `Object.prototype`-Eigenschaften über `finally` wieder her; bekannte `.png`-Dateien müssen weiterhin korrekt ausgeliefert werden.

**Commits der Erweiterung:** `3e759211` (Delivery-Fix) und `9512e0cf` (Prototype-Pollution-Regression). Der **neue Code- und Test-HEAD `9512e0cf`** hat die vollständige [CI 43757127717](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43757127717) **erfolgreich** bestanden. Die beiden späteren Dokumentationsdateien benötigen zusätzlich einen eigenen abschließenden CI-Nachweis.

## Grenzen und nächste Schritte

- Es wurden **keine** Datenbankmigration, Render-Konfiguration, Produktionsdaten, Zugangsdaten oder Deployments verändert. Keine neuen Kosten.
- PR #92 erst nach **grüner vollständiger HEAD-CI**, konfliktfreiem/aktuellem `main`-Abgleich und Review für einen eventuellen **separat freizugebenden Merge** vorsehen; die jetzige Nutzerfreigabe bezog sich auf **PR #91**.
- Bei Fehlern im MIME-Fix: nur PR-Branch anpassen bzw. Commit revertieren; laufende Produktion ist unverändert. Die separaten [PRs #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) und [#90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) bleiben offen; deren kombinierte Integration erfordert eigene Freigabe und CI.

## 15.11.2026 – Kombinierter Sicherheits-Review für #89, #90, #92

- **Konkrete Integrationslücke gefunden:** PR #90 (`nosniff`) und PR #92 (`Object.hasOwn`) bearbeiten beide `src/upload-media-policy.js` und `scripts/test-upload-media-policy.mjs`. Ohne gezielte Zusammenführung könnten Security-Header oder der eigene Mapping-Schlüssel-Check beim späteren Merge verloren gehen. PR #89 und #90 fügen außerdem beide HTTP-E2E-Regressionen in `scripts/test-account-creator-flow.mjs` ein, jedoch in unterschiedlichen Abschnitten.
- Zur Prüfung wurde ein **separater, ausschließlich für CI gedachter Draft-[PR #94](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/94)** auf dem bereits gemergten PR-#91-Mainstand `a4e3daac` erzeugt: Commit `fe9f572`. Er kombiniert die Quota-Schutzprüfungen aus #89, `nosniff` und GET/HEAD-Tests aus #90 sowie MIME-Own-Key- und Prototype-Pollution-Tests aus #92. Gemeinsam veränderte Datei- und Testbereiche wurden bewusst zusammengeführt.
- Die **CI des Draft-PR #94** ist unter [Run 43766460488](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43766460488) eingereicht; Ergebnis erst nach endgültigem GitHub-Status als grün/rot melden. Die isolierten #92-Einzelprüfungen waren zuvor [43757422261](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43757422261) **success**.
- **Keine Freigabe zur Zusammenführung:** #94 dient nur der nicht produktiven Integrationsprobe und darf **nicht** gemergt werden; #89/#90/#92 bleiben bis zu eigenen Reviews und ausdrücklich separaten Merge-Freigaben offen. Ein grüner Kombinationslauf ersetzt keine produktive Backup-/Restore-/Staging-Abnahme; [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) bleibt offen. Keine Render-/Datenbankänderung, kein Deploy.
