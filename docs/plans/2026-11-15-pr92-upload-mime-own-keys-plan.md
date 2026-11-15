# Entwicklungsplan – PR #92 Upload-MIME-Own-Keys

**Stand: 15.11.2026 · PR:** [#92](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/92) · **Status:** Review-Vorbereitung, noch **kein Merge** von #92.

## Ziele und Umsetzung

| Priorität | Paket | Stand / Qualitätskriterium |
| --- | --- | --- |
| **P0** | Verhindern, dass geerbte `Object.prototype`-Schlüssel als MIME-Typen akzeptiert werden | `uploadStorageExtension` prüft `Object.hasOwn(uploadExtensions, mime)`; bestehende gültige Bild-/Video-Typen behalten ihre Endungen. Bereits vor Branch-Synchronisierung in #92 implementiert. |
| **P0** | Aktive Legacy-Dateitypen beim Download auch bei Prototype-Pollution sicher behandeln | `uploadDeliveryHeaders` verwendet `Object.hasOwn(deliveryTypes, extension)`. Geerbte `.svg`/`.html`-Mappings dürfen **keinen** aktiven Content-Type erzeugen; octet-stream und Attachment gelten weiter. Code `3e759211`. |
| **P0** | Gezielte, nicht produktive Regressionen | `scripts/test-upload-media-policy.mjs` prüft geerbte Mapping-Schlüssel, simulierte `Object.prototype`-Manipulation, sicheren Legacy-Download und weiterhin korrektes `.png`. Bereinigung der Test-Prototyp-Eigenschaften in `finally`. Commit `9512e0cf`. |
| **P0** | Keine Rückstände gegenüber `main` | PR #91 ist als `a4e3daac` in `main` gemergt; Main-CI [43756711273](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43756711273) grün. PR #92 wurde über `cd2ba738` mit `main` synchronisiert, anschließend Compare **behind=0**, Sync-CI [43756941671](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43756941671) grün. |
| **P0** | **Finale CI** für Fix, Tests und beide Dokumentationsdateien | Vollständige GitHub-Actions-CI des jeweils aktuellen PR-HEAD **noch kontrollieren**; erst bei Erfolg als bestanden deklarieren. Keine Abkürzung durch alten grünen Lauf. |
| P1 | Review und ggf. Integration #92 | Nur nach aktuellem konfliktfreiem Branch, vollständiger grüner PR-CI und **gesonderter Mergefreigabe**. Anschließend nach genehmigtem Merge `main` erneut prüfen. |

## Abgrenzung und Betreiber-Blocker

- **Keine** neue Infrastruktur, DB-Abfrage/-Migration, Upload in Produktion, Render-Änderung, automatische Bereitstellung oder zusätzlichen Kosten. Produktionsbetrieb bleibt vom Review-Branch getrennt.
- [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) bleibt offen: Betreiberentscheidung zur kostenfreien PostgreSQL-Fortführung bis **20.11.2026**; Ziele **25.11.** echter verschlüsselter Dump und **30.11.** isolierter Restore. Der erfolgreiche Merge von PR #91 hat **keine** dieser Betreiber-Nachweise erbracht.
- [PR #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) und [PR #90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) sind unabhängig offen. Ihre Integration nicht vorziehen.
- Bei unerwartetem Testverhalten: Änderungen ausschließlich in PR #92 korrigieren oder PR-Commits revertieren, keine Live-Änderung. Übergabe: `docs/handover/2026-11-15-pr92-upload-mime-own-keys.md`.
