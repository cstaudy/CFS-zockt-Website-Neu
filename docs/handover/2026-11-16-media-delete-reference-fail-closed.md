# Übergabe – Media-Dateilöschung bei unklarer Referenzprüfung blockieren

**Stand:** 16.11.2026 · **Branch:** `security/media-delete-reference-fail-closed-2026-11-16` · **Basis:** `main` bei `a753eb4156de10985f9a9c6f03611d0939963f9c`. **Nur Code-Review, keine Produktionsaktion.**

## Konkreter Befund

Die bestehende Hilfsfunktion `removeDeletedMediaFile()` in `src/media-file-cleanup.js` löschte die physische Mediendatei bei einem **falsy** Rückgabewert des asynchronen `isReferenced()`-Callbacks. Außer dem erwarteten ausdrücklichen `false` hätten somit auch `undefined`, `null`, `0` und `""` eine Löschung autorisieren können. Solche Werte beweisen **nicht**, dass alle anderen `user_media`- und `creator_assets`-Referenzen fehlen.

**Der aktuelle Aufrufer `deleteUserMedia()` in `src/user-media.js` behandelt fehlende DB-Ergebnisse bereits korrekt** mit `remaining.rows[0]?.referenced !== false`. Dies ist eine gezielte **Defense-in-Depth-Korrektur** der wiederverwendbaren Hilfsfunktion, keine Behauptung einer bereits beobachteten Produktionslöschung.

## Änderung und Tests

- In `src/media-file-cleanup.js` erlaubt nur `(await isReferenced(stored)) === false` eine physische Löschung. Alle anderen Rückgaben liefern konservativ `"referenced"`, ohne die Datei zu berühren. Eine geworfene DB-Ausnahme bleibt unverändert eine Ausnahme, ebenfalls ohne Dateilöschung.
- In `scripts/test-media-file-cleanup.mjs` prüfen neue isolierte Dateisystemtests ausdrücklich `undefined`, `null`, `0`, Leerstring, leeres Objekt, leeres Array und `"false"`: Datei bleibt erhalten, Ergebnis ist `"referenced"`.
- Bestehende positive Fälle bleiben: echte Referenz (`true`) schützt, nur `false` löscht, fremde Dateien werden nicht angefasst, fehlende Dateien bleiben idempotent, DB-Abfragefehler löscht nicht.
- Code `120984e`, Test `41a000a`. **CI des finalen PR-HEAD separat nachweisen**; vor Erfolg keine Mergefreigabe behaupten.

## Operative Grenzen

Alle PRs [#89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89), [#90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90), [#91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91), [#92](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/92) sind gemergt, Main-CI [43775551740](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43775551740) **grün**. Ein neuer PR braucht eigenen Review und separate Mergefreigabe.

[P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) für echten verschlüsselten Backup-/Restore-Nachweis bleibt **OFFEN/GESPERRT**; Render-Free-Datenbankablauf laut bereits ermittelten Metadaten **09.12.2026 18:36:16 UTC**. Die Betreiberentscheidung bis **20.11.2026** ist weiterhin wichtig.

**Kein** Render-/Produktions-DB-Zugriff, Migrationsstart, Datendump, Deployment, Tarifwechsel, neue Kosten oder Merge durch diesen PR. Rollback: den ungemergten Branch verwerfen beziehungsweise isolierten Sicherheitscommit revertieren.
