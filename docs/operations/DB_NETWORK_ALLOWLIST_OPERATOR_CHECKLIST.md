# Betreiber-Checkliste: PostgreSQL-Netzwerkzugang sicher prüfen

**Stand:** 15.11.2026 · **Status: OFFEN – KEINE FREIGABE** · **Zweck:** Vorbereitung für Gate A2 aus `PRODUCTION_BACKUP_STAGING_GATE.md`. Keine automatische Ausführung, keine Render-Änderung.

## Verifizierter Ausgangspunkt (nur Metadaten)
- Bestehende Render-Datenbank: `cfs-zockt-db`, PostgreSQL 18, Free, Status bei read-only Abfrage `available`.
- Ablauf laut Render-Metadaten: **09.12.2026, 18:36:16 UTC**. Kostenlose Verlängerung ist **nicht** bestätigt.
- IPv4-`ipAllowList`: `0.0.0.0/0` (`everywhere`). Das erweitert Netzwerk-Erreichbarkeit; es ist **kein Beweis** für Zugang ohne PostgreSQL-Authentifizierung.
- Produktions-Webservice nutzt `main`, Staging-Service `codex/render-hardening`; beide Auto-Deploy deaktiviert. Staging-DB-Isolation **nicht nachgewiesen**.
- Die benötigten Datenbank-Verbindungswege, Betreiberberechtigungen und sichere IP-Einschränkungen sind **nicht verifiziert**. Keine laufende Änderung aus dieser Checkliste ableiten.
- **Herstellerbestätigung (15.11.2026):** Laut [Render-Dokumentation](https://render.com/docs/postgresql-creating-connecting) steuert die DB-IP-Allowlist **nur externe DB-Verbindungen**. Interne URLs von Render-Diensten in derselben Region und demselben Workspace sind davon ausgenommen. **Nicht verifiziert** ist, welchen URL-Typ der konkrete produktive Dienst nutzt; keine Verbindungsdaten dafür ausgeben oder testweise ändern.
- Render-Free-Postgres hat laut [Herstellerangaben](https://render.com/docs/free) eine 30-Tage-Frist und anschließend nur eine 14-tägige **bezahlte** Upgrade-Nachfrist, keine kostenlose Verlängerungszusage. Laut [Backup-Dokumentation](https://render.com/docs/postgresql-backups) fehlen für Free automatische logische Exporte und Point-in-Time-Recovery; ein autorisierter lokaler `pg_dump` **vor** Ablauf ist möglich und separat mit verschlüsseltem, isoliert geprüftem Restore abzusichern.

## A. Berechtigung und tatsächliche Verbindungspfade

| Nachweis (nur nicht geheime Informationen) | Status |
| --- | --- |
| Verantwortliche Betreiberrolle und ausdrückliche Prüferlaubnis dokumentiert | OFFEN |
| Produktive Render-interne DB-Verbindung und ihr Geltungsbereich bestätigt | OFFEN |
| Alle berechtigt externen Clients (Wartung, Export, Restore, Monitoring) nach Funktion inventarisiert | OFFEN |
| Relevante feste oder wechselnde Client-IP-Adressen **außerhalb des Repositories** geschützt verifiziert | OFFEN |
| Staging-Zugriff und Staging-DB **technisch getrennt** von Produktion belegt | OFFEN |
| Abhängigkeiten von Backups, Notfallzugriff und Anwendungsstart bewertet | OFFEN |

**Vorsicht:** Öffentliche Webservice-URLs sind keine DB-Client-IP-Adressen. Keine DB-URL, Zugangsdaten, realen IP-Listen, Kundendaten oder Tokens in GitHub, CI, Chat oder diese Datei kopieren. Die dokumentierte `0.0.0.0/0`-Freigabe ist eine Metadatenfeststellung, kein aktiver Verbindungstest.

## B. Entscheidungs- und Änderungsfenster

1. Bis zum Planungsziel **20.11.2026** festhalten, welche Clientklassen tatsächlich benötigt werden. Ist eine benötigte IP dynamisch oder ein notwendiger Weg unbekannt, **STOPP**: keine Allowlist-Änderung.
2. Kostenfreie und technisch verfügbare Einschränkungsoptionen anhand der zum Änderungszeitpunkt geltenden Render-Einstellungen **durch den berechtigten Betreiber** überprüfen; insbesondere **internen vs. externen** Datenbank-Verbindungstyp des Live-Dienstes ohne Preisgabe der URL klären. Keine Funktion oder Erreichbarkeit voraussetzen.
3. Vor einem Eingriff Referenzzustand, zuständigen Operator, Kontrollperson, dokumentierten Rückweg und ein genehmigtes Wartungs-/Risikofenster festlegen. Wiederherstellbarkeit des Zugangs muss geklärt sein; kein offener Punkt als bestanden markieren.
4. Für eine autorisierte spätere Änderung einen minimalen Kontrollplan festlegen: Anwendung verbindet sich weiterhin, autorisierte Backup-/Wartungswege funktionieren, unbefugter Netzwerkzugang ist soweit technisch vorgesehen begrenzt. Keine Produktionsdaten in Prüflogs.
5. Bei Verbindungsfehlern, ungeklärter Netzwerkroute, fehlendem Rückweg oder nicht bestätigten Kosten **sofort STOPP**, zuvor freigegebenen Ausgangszustand durch Operator wiederherstellen und separat dokumentieren. Keine Migration, kein Tarifwechsel und kein Deployment als vermeintliche Abhilfe.
6. **Erst nach tatsächlicher Durchführung** dürfen Verantwortliche den Befund mit Zeitpunkt, Prüfumfang und nicht geheimen Ergebnissen im gesonderten Operator-Protokoll abnehmen. Ein grüner CI-Test ist nur Dokumentationsprüfung.

## C. Entscheidungsvorlage – bewusst nicht ausgefüllt

| Entscheidung | Stand |
| --- | --- |
| Erforderliche Verbindungswege und geeignete sichere Einschränkung bestätigt? | NEIN – nicht nachgewiesen |
| Betreiber und Rückweg für geplante Netzwerkänderung ausdrücklich freigegeben? | NEIN – nicht nachgewiesen |
| Durchgeführte Änderung, Verbindungstests und Fehlerfreiheit nachgewiesen? | NEIN – nicht durchgeführt |
| Produktionsbackup mit isoliertem Restore erfolgreich nachgewiesen? | NEIN – nicht nachgewiesen |
| Freigabe von Migration, Staging und Produktivdeployment erteilt? | NEIN – nicht erteilt |

**Gesamtstatus: GESPERRT.** Diese Checkliste fordert keine Änderung selbst an. Die Betriebsentscheidung ist nur vom berechtigten Betreiber zu treffen; Produktionsbackup/Restore und Staging-Isolation bleiben eigenständige, weiterhin gesperrte Gates.

**Verweise:** `PRODUCTION_BACKUP_STAGING_GATE.md`, `DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md`, `FREE_POSTGRES_DEADLINE_DECISION.md`.
