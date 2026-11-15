# Übergabe – PostgreSQL-Backup, Restore und Staging-Freigaben

**Aktueller Snapshot: 15.11.2026.** Dieses Dokument fasst die operative Ausgangslage zusammen. Ältere Zwischenstände, Testkorrekturen und Detail-Commits sind im Git-Verlauf dieser Datei nachvollziehbar.

**Repository:** `cstaudy/CFS-zockt-Website-Neu` · **Branch:** `docs/backup-staging-readiness-2026-11-14` · **PR:** [#91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91), offen/Ready for review, **ungemergt**.

## 1. Abgeschlossen und technisch nachgewiesen

| Paket | Inhalt | Zuletzt vollständig grüner Nachweis vor diesem Snapshot |
| --- | --- | --- |
| [PR #89](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/89) | Upload-Größen- und Quota-Fehlerfälle sicher abweisen; separater Security-PR | HEAD `23c9fd1`, [CI 43631464741](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43631464741) |
| [PR #90](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/90) | `nosniff`, sicherer Download für Legacy-HTML/SVG und echte GET/HEAD-Autorisierungsregressionen | HEAD `53a7ad8`, [CI 43708581500](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43708581500) |
| [PR #91](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/91) | Produktions-Stop-Gates, Betreiber-Checklisten, kostenfreie DB-Frist, Offline-Evidenzguard und synthetische PG18-Rechteprobe | Codecommit **`ad3db97`**, [CI 43736178157](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43736178157) |

Alle drei PRs bei der letzten Prüfung **GitHub mergeable/clean** und review-bereit; **kein formales Review, Merge oder kombinierter CI-Nachweis**. Grün auf einem PR ist weder ein freigegebener Merge noch eine Produktionsfreigabe.

Das bestehende `npm run check` ruft in PR #91 `scripts/test-operator-release-gates.mjs` auf. Der Offline-Test schützt die **27** `OFFEN`-/`NEIN`-Nachweisfelder der Backup-/Restore-Vorlage, die **11** offenen Netzwerk-Prüffelder und die **8** vor einem echten Export offenen Backup-Voraussetzungen. Er prüft Pflichtfeldbezeichnungen, Entfernung und simulierte unbelegte `JA`-Freigaben; er ruft **keine** Render- oder Produktions-DB auf. Die PostgreSQL-18-CI nutzt ausschließlich synthetische Wegwerf-Daten. **Neu:** `scripts/test-pg18-backup-restore.sh` erstellt nach der bestehenden Restore-Akzeptanz eine **separate Quelle und Ziel-DB mit zufälligen Testnamen sowie zwei NOLOGIN-Rollen**; geprüft wird, dass bei `--no-owner --no-acl` die Zeile wiederhergestellt wird, aber ursprünglicher Tabelleneigentümer und synthetischer `SELECT`-Grant fehlen. Strenge CI-URL-/Docker-Schutzprüfung und Cleanup bleiben erhalten. Diese technische Reproduktion des ACL-Verlustes ist **kein** wirklicher Produktionsbackup-Nachweis.

## 2. Produktionsbefund – alles Weitere bleibt GESPERRT

- Render `cfs-zockt-db`: laut Read-only-Metadaten **PostgreSQL 18 / Free / available**, Free-Ablauf **09.12.2026, 18:36:16 UTC (19:36 MEZ)**.
- Laut [Render Free](https://render.com/docs/free): 30-Tage-Free-Laufzeit, danach nicht zugänglich; weitere 14 Tage nur für **bezahlte** Upgrade-Nachfrist, danach Datenlöschung. Keine kostenlose Verlängerung bestätigt. Maximal **eine aktive Free-Postgres-DB pro Workspace**; paralleles kostenloses Render-Staging ist dort nicht als Option nachgewiesen.
- Laut [Render Backups](https://render.com/docs/postgresql-backups): Free-Plan ohne automatische logische Exporte/PITR. Ein echter `pg_dump` **vor Ablauf** ist möglich, aber **nicht erfolgt**. Verschlüsselung, unabhängig geschützter Speicher, tatsächlich isolierter Restore und Freigaben fehlen.
- Read-only Schema-Befund der bestehenden Produktions-DB: ältere Anwendungstabellen vorhanden, aber **kein `schema_migrations`-Ledger**, keine `mfa_login_challenges` (Migration 022) und weitere neue MFA-Spalten (023–025) fehlen. `npm start` könnte Migrationen auslösen; **nicht** gegen Produktion ausführen. Historische 001–021-Baseline und 022–025-Upgrades brauchen gesondert genehmigte, gesicherte Tests.
- Datenbank-IPv4-Allowlist derzeit `0.0.0.0/0`. Laut [Render-Verbindungen](https://render.com/docs/postgresql-creating-connecting) betrifft sie **externe** DB-Verbindungen, nicht interne Render-DB-URLs desselben Workspace/Region. Die vom produktiven Backend tatsächlich benutzte URL-Klasse ist **nicht geprüft**. Keine Live-Allowlist-Änderung ohne Inventar, abgesicherten Rückweg und eigene Freigabe.
- Produktions-Webdienst nutzt `main`, Staging `codex/render-hardening`; beide Auto-Deploy `off`. **Staging-DB-Isolation nicht nachgewiesen.** Keine produktiven Nutzerdaten an Staging übertragen.

## 3. Vorbereitete, nicht ausgeführte Betreiberverfahren

- `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md`: Gate A (Free-Fortführung), A2 (DB-Netzwerk), B (echter verschlüsselter Dump), C (isolierter Restore mit Rechteprüfung), D (getrenntes Staging), E (Migration/Deploy).
- `docs/operations/FREE_POSTGRES_DEADLINE_DECISION.md`: überprüfte Herstellerlimits, kostenfreie Optionen **nicht garantiert**, Planungsfristen und Stop-Kriterien.
- `docs/operations/DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md`: 27 Pflichtnachweise standardmäßig `OFFEN/NEIN`, **Gesamtstatus GESPERRT**.
- `docs/operations/DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md`: 11 `OFFEN/NEIN`-Nachweise, sichere Inventarisierung externer Clients, Netzwerkrückweg und genehmigtes Änderungsfenster.
- `docs/operations/PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`: acht `OFFEN`-Voraussetzungen vor echtem Dump; nur für autorisierte Betreiber. Isolierter Restore mit `--no-owner --no-acl --exit-on-error` erfordert **separate Prüfung** von Objekt-Eigentümern/Grants, DB-Rollen, Constraints, Triggern, Sequenzen, Extensions, Funktionen und ausdrücklich erlaubten isolierten Anwendungstests. Ein einzelner `pg_dump` enthält keine globalen Clusterrollen. Kein Runbook wurde gegen Produktion ausgeführt.

## 4. Neu in dieser Aktualisierung: Verbindlicher P0-Nachverfolgungspunkt

**[GitHub Issue #93 – Betreiberentscheidung und echte Datensicherung vor Render-Ablauf](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93)** wurde am 15.11.2026 als offenes operatives Issue erstellt; keine automatischen Erinnerungen, Assignees oder Freigaben erfunden. In der Issue-Checkliste sind die Entscheidungs- und Abnahmekriterien mit Planungsfristen festgehalten:

- **20.11.2026:** berechtigte Betreiberrolle, Export-/Restore-Rechte, kostenfreies Ziel und notwendige DB-Verbindungswege entscheiden;
- **25.11.2026:** autorisierten, verschlüsselten echten Dump **vor DB-Ablauf** in unabhängigen Speicher sichern;
- **30.11.2026:** technisch isolierten Restore inkl. Rollen-/Rechte-/Schema- und zugelassener Anwendungsprüfung nachweisen;
- **04.12. / 07.12.2026:** Fortführung und finale Stop-/Freigabeentscheidung treffen.

**Das sind ausschließlich Planungsziele; sämtliche Betreiber-Nachweise fehlen.** Das Issue und die Dokumente enthalten keinerlei Geheimnisse oder personenbezogene Datensätze.

## 5. Technischer Sicherheits-Fix am isolierten CI-Restore (15.11.2026)

Bei der PR-Review fiel eine vermeidbare destruktive Testoperation auf: `scripts/test-pg18-backup-restore.sh` verwendete `cfs_ci_restore_acceptance` als **festen** Zieldatenbanknamen und führte vor `createdb` unconditionally `dropdb --if-exists` aus. Auch bei Wegwerf-Tests soll keine möglicherweise bereits existierende Datenbank allein zur Vorbereitung gelöscht werden.

- **Commit `8fc4ccb` – [CI 43740524530 grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43740524530):** Der Restore-Test benutzt jetzt einen pro Lauf zufällig benannten `cfs_ci_restore_acceptance_<nonce>`-Zielnamen, **ohne vorheriges `dropdb`**. `cleanup` entfernt Ziel- und ACL-Probe-Datenbanken **nur nach erfolgreichem eigenem `createdb`**. Eine bereits existierende DB führt zu einem Fehler statt zur Löschung.
- **Commit `6f3554d`:** Auch die beiden `NOLOGIN`-Testrollen werden nur dann aufgeräumt, wenn ihre Erstellung in diesem Lauf erfolgreich war. Kein unbedingtes Löschen zufällig kollidierender Rollen.
- **Commit `a46eac7`:** Zusätzlicher bewusster CI-Kontextschutz: erforderlich sind das explizite Wegwerf-DB-Opt-in, die exakte Test-URL, `GITHUB_ACTIONS=true`, das erwartete Repository und der Job `check`. Vor jedem Docker-Exec wird zusätzlich die gewählte `postgres:18`-Container-Konfiguration auf `POSTGRES_DB=cfs_ci` und `POSTGRES_USER=cfs_ci` geprüft. Dies ist ein Schutz **gegen versehentliche Fehlbedienung**, kein kryptografischer Schutz gegen absichtlich gefälschte Umgebungsvariablen.
- Die neuen Codecommits nach `8fc4ccb` und dieser Dokumentationsstand sind **bis zur tatsächlichen vollständigen CI nicht als grün zu deklarieren**. Die Tests bleiben ausschließlich auf die Wegwerf-PostgreSQL-Datenbank in GitHub Actions beschränkt, mit unverändertem synthetischem ACL-/Restore-Nachweis.

**Produktionsgrenzen unverändert:** Issue [#93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) offen; kein echter Render-Dump, Restore, Staging-DB-Isolationsnachweis, Merge, Deployment, Tarifwechsel oder produktive Datenbankänderung.

## 6. Negativtest der isolierten CI-Restore-Zugriffsgrenze (15.11.2026)

- **Ausgangslage:** PR #91, HEAD `77ef665`, vollständige [CI 43740793960](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43740793960) **success**; #89/#90/#91 ungemergt und zum Review bereit. P0-[Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) weiter offen und nicht als Datensicherungsnachweis zu werten.
- **Konkreter blinder Fleck:** Der echte synthetische PG18-Restore wurde in CI positiv getestet, aber die kürzlich hinzugefügten Verweigerungsbedingungen gegen einen falschen CI-/Docker-Kontext hatten **keinen isolierten Negativtest**. Dadurch könnte ihr späterer versehentlicher Wegfall unbemerkt bleiben.
- **Neu:** `scripts/test-pg18-backup-refusal.mjs` (Commit `b745f7d`) startet das reale Shell-Runbook nur unter harmlosen, absichtlich falsch gesetzten Umgebungen mit einem **lokalen Fake-`docker` in `PATH`**. Fünf Fälle müssen mit Exitcode 2 **vor jedem Docker-Aufruf** scheitern: fehlendes Wegwerf-DB-Opt-in, abweichende Datenbank-URL, kein GitHub-Actions-Kontext, falsches Repository, falscher Job.
- **Zusätzlicher Fall:** Selbst bei passenden CI-Variablen meldet das Fake-`docker` absichtlich einen **fremden PostgreSQL-18-Service** (`POSTGRES_DB=not_ci`). Das Shell-Skript muss nach ausschließlich `docker ps` und `docker inspect` verweigern – **ohne `docker exec`, `pg_dump`, `createdb`, `dropdb` oder Rollenänderung**. Fake-Docker ist kein echter Docker-Daemon und stellt keine Netzwerkverbindung her.
- `package.json` (Commit `daad6f0`) führt den Verweigerungstest ab sofort in `npm run check` nach `bash -n` aus. Der bisherige positive, auf ephemere PG18-CI begrenzte Restore-Test bleibt unverändert. Beide Kontrollen ergänzen sich, ersetzen **kein** echtes Produktionsbackup oder isolierten Betreiber-Restore.
- **CI-Nachweis zur Verweigerungsprüfung:** Der Test- und Dokumentations-HEAD `3ec9412` bestand die vollständige [CI 43742331669](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43742331669). Keine Render-Änderung, keine produktiven SQL-Befehle oder Datenexporte.

**Sicherheitsgrenze:** Diese Tests schützen vor versehentlicher Fehlkonfiguration, nicht vor absichtlich manipulierten CI-Runnern oder gefälschten Umgebungsvariablen. Produktive Betriebsfreigaben bleiben `GESPERRT`.

## 7. Synthetische Backup-Verschlüsselung im PG18-Restore-Test (15.11.2026)

- **Vorheriger Branch-HEAD `3ec9412`:** vollständige [CI 43742331669](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43742331669) **success**. PR #91 blieb offen, ohne gemeldeten Konflikt; [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) weiterhin ohne echten Backup-/Restore-Nachweis.
- **Konkrete bisherige Lücke:** `scripts/test-pg18-backup-restore.sh` prüfte Dump, SHA-256 **des unverschlüsselten** CI-Artefakts und Restore, nicht aber die in Gate B geforderte Strecke **Verschlüsselung → Prüfung des verschlüsselten Artefakts → Entschlüsselung → isolierter Restore**.
- **Neuer Code `195528a` mit Korrektur `0ee443b`:** Synthetischer PG18-Dump wird in der ephemeren CI mittels lokalem GnuPG **AES-256 symmetrisch verschlüsselt**. Ein zufällig erzeugter, ausschließlich temporärer CI-Testschlüssel liegt mit restriktiven Dateirechten im Wegwerf-Verzeichnis und wird nicht protokolliert. Der Test kontrolliert SHA-256 **des Ciphertexts**, entschlüsselt mit derselben vorübergehenden Passphrase, vergleicht das Ergebnis bytegenau mit dem Ausgangsdump und stellt **nur die entschlüsselte Kopie** in einer getrennten CI-Datenbank wieder her. `trap cleanup` entfernt den Testordner samt Ciphertext und temporären Schlüsseldaten.
- Erste CI `195528a` [43743690714](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43743690714) war **rot**, weil ein fehlerhaftes `tr`-Filterformat die 64-stellige Hex-Testpassphrase verkürzte. Die Korrektur `0ee443b` prüfte die gesamte positive PG18-/Website-CI **erfolgreich**: [43743745850](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43743745850).
- `PRODUCTION_BACKUP_STAGING_GATE.md` erklärt jetzt ausdrücklich den **synthetischen** Verschlüsselungsnachweis und die Grenze zu einem echten Produktionsbackup. **CI-Grün ist kein Beleg** für tatsächliche Daten, externe verschlüsselte Ablage, reale Key-Rotation, Datenschutzfreigabe oder produktive Wiederherstellbarkeit; das Betreiberverfahren und seine Schlüsselverwaltung müssen noch separat genehmigt und durchgeführt werden.
- **Keine** Verbindung zur Render-Produktionsdatenbank, kein Dump personenbezogener Daten, kein echter Restore, kein neuer Dienst, kein Tarifwechsel, Merge oder Deployment. Freigabegates A–E bleiben offen bzw. **GESPERRT**.

## 8. Manipulation und falschen Schlüssel vor Restore abweisen (15.11.2026)

- Ausgangslage: PR #91, Commit `2137c22`, [vollständige CI 43744008751 erfolgreich](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43744008751), weiterhin ungemergt; [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) weiter offen. Der vorhandene AES-256-GnuPG-CI-Dump wurde zuvor nur im Erfolgsfall verschlüsselt und wiederhergestellt.
- **Neuer konkreter Negativtest** in `scripts/test-pg18-backup-restore.sh` (Code `0c16553`): In einer **separaten Kopie** des verschlüsselten synthetischen Dumps wird ein zusätzlicher Byte-String angehängt; die zuvor gespeicherte SHA-256-Prüfsumme muss diesen manipulierten Ciphertext **vor Entschlüsselung und SQL-Restore zurückweisen**. Das unveränderte Original bleibt Grundlage der positiven Restore-Probe.
- **Zweiter Negativtest:** GnuPG muss denselben intakten synthetischen Ciphertext mit einem absichtlich **falschen Einmalschlüssel** ablehnen. `--no-symkey-cache` verhindert, dass ein bereits zwischengespeicherter symmetrischer Schlüssel den Test versehentlich erfolgreich macht. Temporäre Kopien, Schlüssel und etwaige Testausgaben werden im abgesicherten Wegwerf-Verzeichnis entfernt. Anschließend läuft die übliche **positive** Entschlüsselung, Bytegleichheitsprüfung, separater PG18-Restore und Schema-/ACL-Test weiter.
- Operatives `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md` (Commit `e873a7b`) verlangt nun vor einer **autorisierten echten** Entschlüsselung den Vergleich des empfangenen verschlüsselten Artefakts mit der **separat dokumentierten Referenz-Prüfsumme** und **STOPP** bei Änderung oder falschem Schlüssel. Einschränkung: SHA-256 schützt vor erkannter Veränderung, **belegt allein keine Authentizität**, wenn Artefakt und Prüfsumme gleichzeitig ausgetauscht werden können.
- **CI auf Code- und finalem Dokumentations-HEAD noch prüfen**; kein Grün für diese Erweiterung vor tatsächlich abgeschlossenem Lauf. Die sechs bisherigen Docker-/CI-Verweigerungstests bleiben aktiv.
- **Keine Produktionsaktion:** Kein echter Dump, Restore, produktives GPG-Schlüsselmaterial, Render-Zugriff, Deployment oder Merge. Dokumentation/CI allein lösen keinen der echten Betreiber-Gates.

## 9. Nächste Schritte, Stop- und Rollback-Regel

1. CI für **diesen neuen Dokumentations-HEAD** prüfen und gegebenenfalls korrigieren. Keine neue Testmatrix ohne konkrete Fehlstelle.
2. PRs #89/#90/#91 separat technisch reviewen. #89 und #90 ändern Teile der gleichen E2E-Datei; nach einer **ausdrücklich genehmigten** Integration ist vollständige kombinierte CI auf aktualisiertem `main` erforderlich.
3. **Betreiber** schließt die Checklisten im [Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) erst nach realen externen Nachweisen ab. Keine Secrets, Connection-Strings, Dumps, Schlüssel oder personenbezogenen Daten in GitHub oder Chat.
4. Bis dahin **kein Merge, kein Render-Upgrade, keine neue kostenpflichtige Ressource, keine produktive IP-Änderung, Datenbankmigration, Datenausleitung oder Deployment** durch diese Entwicklungsarbeit.
5. Rollback dieser PR #91: ungemergten Branch schließen/verwerfen; geändert wurden Operationsdokumente, Offline-Dokumentationstest **und ein ausschließlich auf die isolierte PG18-CI begrenzter Restore-Test**. Keine produktive Laufzeitlogik oder Infrastruktur wurde verändert.

**Übergabestatus: Entwicklung/CI vorbereitend; echter Produktionsbackup-/Restore-/Staging-/Deploynachweis weiterhin GESPERRT.**
