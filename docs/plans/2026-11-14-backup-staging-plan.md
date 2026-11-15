# Entwicklungsplan – P0-Datensicherung und kontrollierte Release-Freigabe

**Aktueller Stand: 15.11.2026 · Status: GESPERRT für Produktion.** Dies ist der konsolidierte Arbeitsstand für [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91). Ältere, teils inzwischen überholte CI-Zwischenstände bleiben im Git-Verlauf nachvollziehbar. Maßgeblich ist die tatsächlich ausgeführte CI auf dem jeweiligen HEAD.

## Ziel und Priorität

**Das Wichtigste ist die Sicherung der realen Nutzerdaten vor dem Ablauf der Render-Free-PostgreSQL-Datenbank.** Die Read-only-Render-Metadaten bestätigen **09.12.2026, 18:36:16 UTC** als Ablauf. Ein normales kostenloses Verlängerungsangebot, eine zweite aktive Free-DB im selben Workspace und ein automatisches Free-Backup dürfen nach den aktuellen [Render-Free-Bedingungen](https://render.com/docs/free) und [Backup-Regeln](https://render.com/docs/postgresql-backups) nicht vorausgesetzt werden.

Der neue **[P0-Betreiberauftrag #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93)** ist der zentrale Ort zur Nachverfolgung von Entscheidungen und **nicht geheimen** Abnahmen. Der Auftrag bleibt offen; das Erstellen des Issues ist **kein Backup-/Restore-Nachweis**.

## Priorisierte Arbeit und Gate-Abhängigkeiten

| Priorität / Termin (Planungsziel) | Aufgabe | Stand / Voraussetzung für Abnahme |
| --- | --- | --- |
| **P0 – 20.11.2026** | Berechtigte Betreiberrolle, echte Export-/Restore-Befugnis, kostenlose Zieloption, zulässige geschützte Ablage, Datensicherheit und benötigte DB-Clients entscheiden | **OFFEN** – [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93); keine bestätigte kostenfreie Fortführung |
| **P0 – 25.11.2026** | Verschlüsselten **echten** PostgreSQL-Custom-Dump **vor Ablauf** durch autorisierten Betreiber erstellen; SHA-256 der verschlüsselten Datei und unabhängigen Speicher nachweisen | **GESPERRT** – acht `OFFEN`-Vorbedingungen im `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`, kein ausgeführter Dump |
| **P0 – 30.11.2026** | Restore **in technisch getrennte, leere Wegwerf-DB**, mit neutralem Schema-/Daten-Nachweis und gesonderter Rolle-/Grant-/Indizes-/Trigger-/Sequenz-/Extension-Prüfung | **GESPERRT** – weder Zielisolation noch echter Restore oder Rechteprüfung nachgewiesen; `--no-owner --no-acl` überträgt Rechte nicht |
| **P0 – bis 04.12.2026** | Tatsächlich kostenlose, datenschutzkonforme und technisch tragfähige Fortführung wählen; Staging-DB-Trennung belegen | **GESPERRT** – keine zweite freie Render-Postgres im selben Workspace garantiert, Staging-Isolation nicht nachgewiesen |
| **P0 – bis 07.12.2026** | Gesonderte Stop-/Freigabeentscheidung vor DB-Ablauf; technische Baseline/Migration nur nach echten Backup-/Restore-/Schema-Gates | **GESPERRT** – fehlendes `schema_migrations`-Ledger in Produktion, Migrationen 022–025 nicht vorhanden |
| **P0 – nach Betreiberfreigabe** | DB-IPv4-Allowlist `0.0.0.0/0` risikobewusst auf erforderliche **externe** Zugänge begrenzen | **OFFEN** – produktiver interner/externer URL-Typ unbekannt; Backup-Clients und Notfallrückweg zuerst verifizieren. Kein blindes Sperren |
| **P1 – nach Review** | Security-PRs [#89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89), [#90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) und Operations-PR [#91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) separat prüfen | Einzel-PRs zuletzt grün/clean; **kein Review/Merge genehmigt**. #89/#90 berühren dieselbe E2E-Datei in verschiedenen Bereichen; kombinierte CI erst **nach genehmigter Integration** |
| **P1 – vor jedem Deploy** | Isolierte Staging-Migration, Browser-/OBS-/Admin-/Creator-Abnahme sowie Rollback | **GESPERRT** – technische Staging-DB-Trennung, wirkliche Restore-Abnahme und getrennte Deploymentfreigabe fehlen |

Die Daten sind **Zieltermine, keine automatischen Termine oder Ausführungszusagen**. Bei fehlender Betreiberberechtigung, unklaren Kosten, nicht nachgewiesener DB-Isolation oder Restore-/Rechtefehlern: **STOPP** und keine produktive Änderung.

## Bereits umgesetzte Entwicklungsleistung

1. **PR #91:** fünf Operationsverfahren inklusive `PRODUCTION_BACKUP_STAGING_GATE.md`, `FREE_POSTGRES_DEADLINE_DECISION.md`, `DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md`, `DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md` und `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`. Alle dokumentieren offene Freigaben; **kein realer Export oder Restore**.
2. **Offline-Regressionsschutz:** `scripts/test-operator-release-gates.mjs` läuft in `npm run check` und prüft die **27** Pflichtfelder der Evidenzvorlage, **11** Netzwerkprüffelder und **8** Backup-Stop-Voraussetzungen samt Mutationen, zusätzlich Rollen-/ACL- und Strukturabnahme im Restore-Runbook.
3. **Letzter grüner PR #91 HEAD vor diesem Update:** `cb2f964`, vollständige [GitHub Actions 43726769829](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43726769829) **success**. PR #89 HEAD `23c9fd1` [CI 43631464741](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43631464741) und PR #90 HEAD `53a7ad8` [CI 43708581500](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43708581500) jeweils grün. Alle drei PRs offen, zuletzt konfliktfrei.
4. **Diese Aktualisierung:** separates P0-Tracking-[Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) mit Terminen, Entscheidungsverantwortung, Nachweisen und Stop-Regeln angelegt; Übergabe und Plan für ein eindeutiges aktuelles Review zu einer kurzen, nicht chronologischen Fassung konsolidiert.

## Nächste Entwicklungsrunde

1. **Aktuellen CI-Lauf** nach dieser Übergabe-/Planänderung prüfen; Fehler ausschließlich begründet korrigieren. **Kein** automatisches „grün“, bevor GitHub Actions für den neuen HEAD Erfolg gemeldet hat.
2. Issue #93 dient dem Betreiber als sichtbarem P0-Nachverfolgungspunkt. Erst nach echten externen Nachweisen den Status dort durch Berechtigte ändern; niemals Freigabe-Checkboxen hypothetisch abhaken.
3. PR #91 und die unabhängigen PRs #89/#90 zum **formalen Review** geben. Kein Merge ohne ausdrückliche Genehmigung; danach Gesamt-CI auf aktualisiertem `main`.
4. Keine weitere Mutationstest-Ausweitung ohne neuen Befund. Die nächsten entscheidenden Fortschritte hängen von Berechtigung, tatsächlich kostenloser Fortführungsoption und ausgeführtem realem Backup-/Restore-Beleg ab.

## Grenzen und Rollback

Keine produktive Datenbankabfrage/Schreibaktion, Migration, Geheimnisweitergabe, Datenausleitung, Backup/Restore, Tarifwechsel, Render-Allowlist-Änderung, neue Ressource, Staging-/Produktivdeployment oder Merge ohne ausdrücklich getrennte Berechtigung. Eine grüne CI mit synthetischem PG18 ist **kein Produktionsnachweis**. Der ungemergte PR #91 kann ohne Live-Laufzeitänderung verworfen werden; Änderungen liegen in Operations-Dokumentation und lokalem Dokumentations-Guard. Übergabe: `docs/handover/2026-11-14-backup-staging-gates.md`.
