# Entwicklungsplan – Medien-Datei nur bei ausdrücklich fehlender Referenz löschen

**16.11.2026 · Neuer Sicherheits-Branch `security/media-delete-reference-fail-closed-2026-11-16` · Produktion weiterhin gesperrt.**

| Priorität | Arbeitspaket | Stand / Abnahme |
| --- | --- | --- |
| **P0** | Media-Cleanup muss bei unklarer Datenbankantwort konservativ handeln | Implementiert: `src/media-file-cleanup.js` löscht nur bei strikt booleschem `false`; sonst `"referenced"`. Code `120984e`. |
| **P0** | Negativfälle ohne Produktionsdatenbank testen | Implementiert: sieben zweifelhafte Werte (`undefined`, `null`, `0`, `""`, `{}`, `[]`, `"false"`) dürfen keine Datei löschen. Regression `41a000a`; bisherige explizit-false-, true-, Fehler-, Owner- und Collision-Tests bleiben. |
| **P0** | Branch in CI prüfen | `npm run check`, PostgreSQL-18-Wegwerf-CI und vollständiger E2E-Workflow **am finalen HEAD**: **noch prüfen**. Keine Erfolgsmeldung vor abgeschlossenem Lauf. |
| **P1** | Separaten PR reviewen | Nur bei vollständigem CI-Erfolg, `main`-Kompatibilität und **separater Mergefreigabe**. Keine automatischen Merges oder Deployments. |
| **P0 unabhängig** | Echte Free-DB vor Ablauf sichern | [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) **OFFEN**: Betreiberentscheidung Ziel **20.11.**, autorisierter verschlüsselter Dump Ziel **25.11.**, isolierter Restore Ziel **30.11.**, Ablauf **09.12.2026 18:36 UTC**. Keine produktive Sicherung oder Wiederherstellung durch CI. |

**Bisher nachgewiesen:** Hauptbranch `a753eb4156de10985f9a9c6f03611d0939963f9c` mit gemergten #89/#90/#91/#92, vollständige [Main-CI 43775551740](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43775551740) **success**.

**Sicherheitsgrenzen:** Keine produktive Datenbankabfrage, Dateilöschung, Migration, Render-Konfigurationsänderung, Deployment, Secrets, kostenpflichtigen Ressourcen oder Freigabe. Dokumentation des Befunds: `docs/handover/2026-11-16-media-delete-reference-fail-closed.md`.
