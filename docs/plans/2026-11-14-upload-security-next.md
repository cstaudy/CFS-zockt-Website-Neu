# Entwicklungsplan – sichere Uploads und freigabegesteuerte Releases

**Stand:** 15.11.2026 · **PR #90:** [Upload delivery `nosniff`](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90), offen und review-bereit. **Kostenrahmen:** vorhandene GitHub-Actions-CI mit ephemerem PostgreSQL 18; keine kostenpflichtigen Zusatzressourcen.

## Ergebnisstand

| Priorität | Ziel | Ist / Nachweis | Nächster Schritt |
| --- | --- | --- | --- |
| P0 | Bild-/Video-/Legacy-Upload vor MIME-Sniffing schützen | `uploadDeliveryHeaders()` setzt `nosniff`; unbekannte Endungen erzwingen Download. Letzter vollständiger Branch-HEAD `da0ff0b` erfolgreich ([CI 43707471165](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43707471165)). | CI nach neuer SVG-E2E-Erweiterung und finalem Dokumentations-HEAD prüfen |
| P0 | Zugriff und Widerruf über echten HTTP-Pfad prüfen | Isolierte PG18-E2E-Matrix: Bild/Video, GET+HEAD, `401/404/200`, OBS-Veröffentlichung, Revocation, Fremdlöschung, wiederholte Löschung, unbekannte URL und Header | PR #90 reviewen; keine weitere künstliche Matrix-Ausweitung ohne Befund |
| P0 | Aktive Legacy-Inhalte als Download behandeln | HTTP-Test bisher `.html`; neuer Test `6cd18e0` erweitert um `.svg`, exaktes `attachment; filename="download"` und anonyme GET/HEAD-Sperre | Neue CI abwarten; danach Browser-/OBS-Abnahme separat |
| P0 | Quota-/Upload-Größengrenzen absichern | [PR #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) offen, grün, ungemergt | Separate Review-/Mergeentscheidung |
| P0 | Produktionsbackup und isolierten Restore beweisen | **GESPERRT:** kein verifiziertes echtes Produktionsbackup/Restore; siehe [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) | Berechtigte Betreiberentscheidung und dokumentierter Restore in separater DB |
| P0 | Ablauf kostenloser PostgreSQL-Instanz abwenden | **Offen:** Render-Free-DB-Frist **09.12.2026**; Fortsetzung / Datenexport nicht bestätigt | Frühzeitig Betreiberentscheidung über zulässige kostenlose Fortsetzung oder sicheren Migrationsweg; keine Kosten ohne Zustimmung |
| P0 | Produktive Migrations-/Baseline-Sicherheit | **GESPERRT:** kein `schema_migrations`-Ledger in der geprüften produktiven DB; kein bestätigter isolierter Staging-Datenbestand | Erst nach Backup/Restore und expliziter Freigabe read-only Preflight / geplantes Vorgehen |
| P1 | Sicheres Browser-/OBS-Verhalten validieren | CI prüft HTTP und Header, ersetzt keinen echten Browser | Auf sicherer Testumgebung manuell Bild/Video/Legacy-Download und OBS prüfen |
| P1 | Kombinierte PR-Kompatibilität sicherstellen | #89 und #90 ändern `scripts/test-account-creator-flow.mjs` in getrennten Hunk-Bereichen (Basis 772 bzw. 887); #91 ohne beobachtete Dateiüberschneidung | **Nach jedem genehmigten Merge** vollständige CI auf aktualisiertem `main`, Konflikte und Schema-Migrationen erneut prüfen |

## Konkrete Reihenfolge

1. **Jetzt:** CI für `6cd18e0` und den danach aktualisierten Dokumentations-HEAD verifizieren; bei Fehlschlag nur die isolierte Test-Fixture korrigieren. Übergabe: `docs/handover/2026-11-14-upload-nosniff.md`.
2. **Review:** #90 auf sichere Header und mögliche Browser-Kompatibilitätsänderungen prüfen. Weiteres unbegründetes Testwachstum vermeiden; stattdessen dokumentierte Abnahme.
3. **Nach separater Freigabe:** einen PR mergen, CI auf dem aktualisierten `main` abwarten, die verbliebenen PRs erneut gegen `main` prüfen. Grüne Einzel-PRs sind keine kombinierte Testfreigabe.
4. **Vor jedem Deployment:** Browser-/OBS-Abnahme, echtes Produktionsbackup mit verschlüsselter Ablage, erfolgreicher Restore in isolierter Wegwerf-DB, Staging-Trennung und abgestimmter PostgreSQL-Baseline nachweisen. Die Vorgaben aus PR #91 bleiben GESPERRT, bis dafür echte Nachweise vorliegen.
5. **Betriebssicherung bis 09.12.2026:** Entscheidungen zur Free-DB-Frist rechtzeitig von berechtigtem Betreiber treffen lassen. Keine Migration, bezahlter Tarif, neue Ressource oder Datenexport aus Produktion ohne Erlaubnis.

## Stop-/Rollback-Regeln

- **Kein eigenständiger Merge, kein Deployment, keine produktive Datenbankänderung, keine Secret-Änderung und keine zusätzlichen Kosten.**
- CI-Fehler stoppen die Freigabe; dokumentierte lokale/isolierte Tests ersetzen keine ausgeführte vollständige GitHub-CI.
- Falls `nosniff` zuvor falsch klassifizierte Bestandsdateien im Browser sichtbar anders behandelt, erst in einer isolierten Umgebung untersuchen; PR vor Merge anpassen oder nach genehmigtem Merge den Header-Commit gezielt revertieren.
- Zu **jeder weiteren Aktualisierung** Übergabe **und** Entwicklungsplan auf demselben Branch aktualisieren und den CI-Status zum neuen HEAD wahrheitsgemäß erfassen.

## 16.11.2026 – PR-#90-Merge-Freigabe und Reihenfolge

| Pflichtschritt | Stand |
| --- | --- |
| Erst PR #89 separat mergen, vollständige neue Main-CI prüfen | **Erledigt:** `336427d`, [CI 43774832762](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43774832762) erfolgreich |
| PR-#90-Branch auf neuen `main` bringen und die HTTP-E2E-Fälle aus #89 **und** #90 erhalten | **In dieser Synchronisierung vorbereitet**; `scripts/test-account-creator-flow.mjs` aus dem bereits [grün kombinierten Draft #94](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43766460488) mit beiden Testblöcken |
| Vollständige neue #90-CI und fehlende Konflikte nachweisen | **Vor Merge zwingend prüfen**, kein vorzeitiges Erfolgsetikett |
| #90 nur nach grüner CI und aktueller Main-Basis mergen | **Von Nutzer zur Prüfung und zum Merge freigegeben**, aber erst nach erfolgreicher voriger Prüfung |
| Anschließend Main-CI, dann PR #92 mit `nosniff` + `Object.hasOwn` erhalten synchronisieren, prüfen und mergen | **OFFEN**; kein Blind-Merge, Integrations-Draft #94 war gemeinsam grün |
| P0 Free-Postgres sichern | **GESPERRT**, echter autorisierter Dump und Restore fehlen, [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) offen |

Kein Render-/DB-/Produktionszugriff, keine Tariferhöhung oder Deployment-Aktion durch die geplanten PR-Merges.
