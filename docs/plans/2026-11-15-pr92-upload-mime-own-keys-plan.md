# Entwicklungsplan – PR #92 Upload-MIME-Own-Keys

**Stand: 15.11.2026 · PR:** [#92](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/92) · **Status:** Review-Vorbereitung, noch **kein Merge** von #92.

## Ziele und Umsetzung

| Priorität | Paket | Stand / Qualitätskriterium |
| --- | --- | --- |
| **P0** | Verhindern, dass geerbte `Object.prototype`-Schlüssel als MIME-Typen akzeptiert werden | `uploadStorageExtension` prüft `Object.hasOwn(uploadExtensions, mime)`; bestehende gültige Bild-/Video-Typen behalten ihre Endungen. Bereits vor Branch-Synchronisierung in #92 implementiert. |
| **P0** | Aktive Legacy-Dateitypen beim Download auch bei Prototype-Pollution sicher behandeln | `uploadDeliveryHeaders` verwendet `Object.hasOwn(deliveryTypes, extension)`. Geerbte `.svg`/`.html`-Mappings dürfen **keinen** aktiven Content-Type erzeugen; octet-stream und Attachment gelten weiter. Code `3e759211`. |
| **P0** | Gezielte, nicht produktive Regressionen | `scripts/test-upload-media-policy.mjs` prüft geerbte Mapping-Schlüssel, simulierte `Object.prototype`-Manipulation, sicheren Legacy-Download und weiterhin korrektes `.png`. Bereinigung der Test-Prototyp-Eigenschaften in `finally`. Commit `9512e0cf`. |
| **P0** | Keine Rückstände gegenüber `main` | PR #91 ist als `a4e3daac` in `main` gemergt; Main-CI [43756711273](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43756711273) grün. PR #92 wurde über `cd2ba738` mit `main` synchronisiert, anschließend Compare **behind=0**, Sync-CI [43756941671](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43756941671) grün. |
| **P0** | **Finale CI** für Fix, Tests und beide Dokumentationsdateien | Code- und Test-HEAD `9512e0cf` in [CI 43757127717](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43757127717) **vollständig grün**; abschließenden CI-Lauf des Dokumentations-HEAD weiterhin prüfen. Kein Merge von PR #92 ohne gesonderte Freigabe. |
| P1 | Review und ggf. Integration #92 | Nur nach aktuellem konfliktfreiem Branch, vollständiger grüner PR-CI und **gesonderter Mergefreigabe**. Anschließend nach genehmigtem Merge `main` erneut prüfen. |

## Abgrenzung und Betreiber-Blocker

- **Keine** neue Infrastruktur, DB-Abfrage/-Migration, Upload in Produktion, Render-Änderung, automatische Bereitstellung oder zusätzlichen Kosten. Produktionsbetrieb bleibt vom Review-Branch getrennt.
- [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) bleibt offen: Betreiberentscheidung zur kostenfreien PostgreSQL-Fortführung bis **20.11.2026**; Ziele **25.11.** echter verschlüsselter Dump und **30.11.** isolierter Restore. Der erfolgreiche Merge von PR #91 hat **keine** dieser Betreiber-Nachweise erbracht.
- [PR #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) und [PR #90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) sind unabhängig offen. Ihre Integration nicht vorziehen.
- Bei unerwartetem Testverhalten: Änderungen ausschließlich in PR #92 korrigieren oder PR-Commits revertieren, keine Live-Änderung. Übergabe: `docs/handover/2026-11-15-pr92-upload-mime-own-keys.md`.

## 15.11.2026 – Gezielter gemeinsamer Security-Integrationstest

| Priorität | Aufgabe | Status / Abnahme |
| --- | --- | --- |
| **P0** | PR #90 und #92 überlappen in Upload-Policy und Unit-Test | **Bestätigt:** `src/upload-media-policy.js` und `scripts/test-upload-media-policy.mjs` müssen bei späterem Merge beide Sicherheitsmerkmale (`nosniff` und `Object.hasOwn`) behalten. |
| **P0** | HTTP-E2E-Erweiterungen #89/#90 gemeinsam überprüfen | **Vorbereitet:** beide getrennt eingefügten Testblöcke sind im nicht produktiven Draft-[PR #94](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/94) erhalten. Nicht von isolierten Einzeltests auf gemeinsame Funktion schließen. |
| **P0** | Tatsächliche kombinierte CI vor Merge-Empfehlung | **Bestanden:** Draft #94 Commit `fe9f572`, [Actions 43766460488](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43766460488) **success**. Der reine Integrations-Draft wurde **ohne Merge geschlossen**; Nachweis bleibt über CI und Pull Request erhalten. Individuelle Merges #89/#90/#92 weiterhin separat freigeben. |
| **P0** | PR #92 weiterhin eigenständig reviewbar | Einzel-HEAD `ef2df4d` war [CI 43757422261](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43757422261) **success** und zum Zeitpunkt des Integrationschecks ohne Rückstand zu `main`. Nach den Dokumentationsupdates den **neuen PR92-HEAD** erneut per CI bestätigen. |
| **P0** | Operative Free-DB-Risiken getrennt halten | [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) **OFFEN**, keine echten Backup-/Restore-Nachweise; keine Render-, DB- oder Deploy-Aktionen durch den Testbranch. |

**Entscheidungsgrenze:** User hat ausdrücklich den Merge von PR #91 genehmigt, **nicht** #89/#90/#92/#94. PR #94 bleibt ein Draft ohne Mergeschritt. Vor jeder eigenständigen Integration die konkrete Code-Kombination prüfen und separate Nutzerfreigabe abwarten.

## 16.11.2026 – Finaler #92-Merge nach #89/#90

| Gate | Status |
| --- | --- |
| Nutzerfreigabe für Merges #89/#90/#92 | **Erteilt** nach Einzel- und gemeinsamem Test |
| #89-Merge und Main-CI | **Erledigt** `336427d`, [CI 43774832762](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43774832762) **success** |
| #90-Merge und Main-CI | **Erledigt** `504af605`, [CI 43775213418](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43775213418) **success** |
| #92-Synchronisierung mit neuer Main-Basis | **In dieser Änderung**: Quellcode/Test aus der zuvor [grünen Integration #94](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43766460488), sodass `nosniff` und Own-Key-Guards **gemeinsam** erhalten bleiben |
| #92-Sync-CI, konfliktfreier und rückstandsfreier Vergleich | **Vor Merge erneut prüfen**, Erfolg nicht vorwegnehmen |
| #92 nach Erfolg mergen und Main-CI prüfen | **Freigegeben, aber nur nach grüner #92-CI**; kein Prod-Deploy |
| Echte Produktiv-DB-Sicherung und Staging-Trennung | **Nicht ausgeführt/GESPERRT** – P0-[Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) |

Bei roten Checks abwarten und gezielt korrigieren. Keine produktiven Migrationen, Render-Änderungen, Tarife oder Deployments.
