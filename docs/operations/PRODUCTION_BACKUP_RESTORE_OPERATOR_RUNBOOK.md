# Betreiber-Runbook: Render-Free-PostgreSQL vor Ablauf sicher sichern und Restore nachweisen

**Stand: 15.11.2026 · GESAMTSTATUS: GESPERRT · NUR PLANUNG.**

**Nicht ausführen, bevor ein berechtigter Betreiber jede Vorbedingung dokumentiert und separat freigegeben hat.** Dieses Dokument führt keinen Dump, Restore, Datenexport oder SQL-Befehl aus und schafft keine Render-Ressource. Es enthält keine realen Verbindungsstrings, Zugangsdaten, IP-Adressen, Kundendaten, Dumps oder Schlüssel.

## 1. Warum die Vorbereitung dringend ist

- Render meldet für die bestehende Free-Datenbank `cfs-zockt-db` **09.12.2026, 18:36:16 UTC** als Ablauf. Laut [Render Free](https://render.com/docs/free) wird die Free-Datenbank nach 30 Tagen unzugänglich; die 14-tägige Nachfrist dient einem **kostenpflichtigen** Upgrade, danach droht Datenlöschung.
- Render Free hat laut [Postgres Backups](https://render.com/docs/postgresql-backups) keine automatischen logischen Backups und kein PITR. Ein berechtigter Betreiber kann **vor Ablauf** eine eigene `pg_dump`-Sicherung anfertigen. Das ist noch **nicht** erfolgt.
- Pro Workspace ist laut Render nur **eine gleichzeitig aktive Free-Postgres-Datenbank** möglich. Ein kostenloses paralleles Render-Staging oder -Restore im selben Workspace darf nicht angenommen werden.
- Die bestehende Produktionsdatenbank besitzt laut read-only Schema-Befund **kein `schema_migrations`-Ledger**. Restore **nicht** mit automatischen Migrationen oder einer Baseline kombinieren.

## 2. Stop-Gates vor einem echten Export

| Zwingende Vorbedingung | Status |
| --- | --- |
| Zuständige Betreiberrolle und ausdrückliche Erlaubnis für **Produktiv-Datenexport** dokumentiert | OFFEN |
| Kostenfreie, rechtlich zulässige und zugriffsgeschützte **externe Ablage** bestätigt | OFFEN |
| Geeignetes Verschlüsselungsverfahren und getrennte Schlüsselverwaltung bestätigt | OFFEN |
| PostgreSQL-18-kompatible Clientwerkzeuge sowie benötigter DB-Netzwerkzugang bestätigt | OFFEN |
| Konkretes Backup-Fenster, Speicherplatz und ausreichend Zeit vor 09.12.2026 bestätigt | OFFEN |
| Kostenfreie **isolierte Restore-Zielumgebung** und technische Trennung von Produktion belegt | OFFEN |
| Datenschutz, Aufbewahrungsdauer, Vertraulichkeit und geregelte Löschung freigegeben | OFFEN |
| Rollback-/Notfallverantwortliche und Abbruchweg bestätigt | OFFEN |

**Jedes OFFEN bedeutet STOPP.** Keine Zugangsdaten in Repository, Tickets, Chat, Terminalausgaben oder GitHub-Actions-Artefakte kopieren. Eine erfolgreiche CI mit synthetischer PG18-Datenbank beweist keine erfolgreiche Sicherung echter Nutzerdaten.

## 3. Autorisierter Sicherungsablauf – nur nach allen Vorbedingungen

**Schritt 1 – Ausgangslage schützen.** Berechtigter Betreiber prüft im gesicherten Administrationskanal Identität der **Quell-DB**, Erreichbarkeit vor dem Ablauf, erwartete Datengröße und die für `pg_dump` nötige Rolle. Prüfen, dass der verwendete Client tatsächlich PostgreSQL-18-kompatibel ist. Verbindungsdetails bleiben ausschließlich im geschützten Secret-System; niemals in Skriptdateien/Logs einbetten.

**Schritt 2 – Konsistenten logischen Export anfertigen.** Berechtigter Betreiber erstellt während des vereinbarten Fensters einen PostgreSQL-Custom-Format-Dump (typischer Aufruf: `pg_dump -Fc --no-owner --no-acl`) mit vom Betreiber geschützt bereitgestellter **Quellverbindung**. Den Dump **nur** in einem lokalen, zugangsbeschränkten temporären Verzeichnis mit restriktiven Dateirechten halten; keine `pg_dump`-Ausgabe in ein Git-Repository oder CI-Artefakt schreiben. Export-Exitcode und UTC-Zeit erfassen, aber keine Tabelleninhalte protokollieren.

**Schritt 3 – Vor einer Übertragung verschlüsseln.** Mit dem **vorab bestätigten** Verschlüsselungsverfahren verschlüsseln; Schlüssel getrennt vom Artefakt verwahren. Die verschlüsselte Datei in unabhängigen, zugriffsbeschränkten Speicher übertragen. SHA-256 **nur über die verschlüsselte Datei**, Größe, Exitcode, Aufbewahrungsregel und einen neutralen Speicherortbezeichner ins gesonderte Abnahmeprotokoll aufnehmen. Klartextkopie anschließend nach Betreiber-/Datenschutzvorgabe sicher behandeln und nicht im ungeschützten Umfeld zurücklassen.

**Schritt 4 – Export nicht mit Restore verwechseln.** Ein erfolgreiches `pg_dump`, eine Datei oder Prüfsumme allein **genügt nicht**. Erst ein geprüfter Restore in **physisch/technisch getrennter Wegwerf-DB** belegt grundsätzliche Wiederherstellbarkeit.

## 4. Getrennter Restore – produktive Verbindung niemals als Ziel

Vor Beginn sind **Quell- und Zielidentität durch zwei getrennte Prüfschritte** zu bestätigen (technische DB-/Instanz-Identität, Workspace/Host, kein Verweis der produktiven Anwendungen auf die Ziel-DB). Die Restore-DB muss **neu und leer** sein. Bloße Abweichung des DB-Namens ist kein hinreichender Trennungsnachweis.

1. Verantwortlicher Betreiber bestätigt separat **Restore-Berechtigung**, Datenschutz und eindeutige Zielidentität; ohne diese Dokumentation **STOPP**.
2. **Vor jeder Entschlüsselung** die SHA-256-Prüfsumme der aus unabhängiger Ablage empfangenen **verschlüsselten** Sicherung gegen den **getrennt dokumentierten Referenzwert** vergleichen. Bei Abweichung: **STOPP**, keine Entschlüsselung oder Wiederherstellung. Eine SHA-256-Prüfsumme beweist alleine **keine Authentizität**, wenn jemand zugleich Artefakt und Referenz verändern konnte. Erst nach erfolgreicher Prüfung im abgeschotteten Ziel und mit gesondert berechtigtem Schlüssel entschlüsseln; falscher Schlüssel, fehlende Integritätsprüfung oder GnuPG-Fehler bedeuten **STOPP**. Den erhaltenen Dump mit `pg_restore --list` auf Lesbarkeit prüfen.
3. `pg_restore` ausschließlich **gegen die verifizierte, leere Wegwerf-DB** ausführen, mit `--no-owner --no-acl --exit-on-error` und kompatibler Clientversion. **Kein** `--clean` gegen produktive/unklare Ziele und **kein** Start von `npm start`, `npm run migrate`, `npm run migrate:baseline` oder anderen automatischen Migrationen.
4. Restore-Exitcode, UTC-Zeit, Tabellen-/Spalteninventar und erwartete Schema-Merkmale vergleichen. Nur **nichtpersonenbezogene aggregierte** Tabellenzählwerte und einen erlaubten Schema-Fingerprint dokumentieren. Keine Konten, Tokens, Sessions, E-Mail-Adressen oder Klartextdaten veröffentlichen.
5. **Berechtigungen separat abnehmen:** Die Restore-Optionen `--no-owner` und `--no-acl` übernehmen **keine** ursprünglichen Eigentümerzuweisungen oder `GRANT`/`REVOKE`-Befehle. In der isolierten Zielumgebung daher DB-/Schema-/Objekt-Eigentümer, Anwendungsrolle und **minimal erforderliche** Rechte auf Tabellen, Views, Sequenzen und Funktionen durch autorisierten Betreiber inventarisieren. Fehlende Rollen/Grants sind ein **eigener STOPP-Grund**; keine Produktionsrolle oder Secrets kopieren und Rechte nicht pauschal auf `PUBLIC` erweitern.
6. **Struktur allein reicht nicht:** Isoliert (ohne produktive Clients) auch vorhandene Indizes, Foreign Keys, Constraints, Trigger, Sequenzstände, Erweiterungen und deren Versionen sowie erforderliche Funktionen/Abhängigkeiten gegen einen zuvor genehmigten Soll-Stand prüfen. Ein erfolgreicher `pg_restore`-Exitcode plus Tabelleninventar beweist **keine** vollständige Anwendungsfähigkeit. Bei nicht belegbarer Übereinstimmung **STOPP**.
7. **Autorisierter Anwendungstest nur in der isolierten Umgebung:** Nach separater Freigabe kontrollierte read-only Probe mit einer dedizierten, minimal berechtigten **Test-Anwendungsrolle**, **ohne** produktive Sessions, ausgehende Integrationen oder automatischen Migrationsstart. Test-/Rollenresultate nur als nicht geheime Metadaten dokumentieren. Die echte Produktionsanwendung niemals gegen die Restore-DB umkonfigurieren.
8. Ein fehlendes Migrationsledger in der Ausgangsdatenbank darf im Restore **nicht** als bereits ausgeführte Migration fingiert werden. Baseline/MFA-Migrationen benötigen einen **separaten**, später freigegebenen Test nach dem bewiesenen unveränderten Restore.
9. Bei Fehler oder Abweichung: Restore stoppen, **nur** die nachweislich isolierte Wegwerf-DB gemäß genehmigtem Verfahren verwerfen; Quelle/Produktion nicht verändern. Keine stillschweigende Wiederholung gegen eine andere URL.

### Warum die zusätzlichen Checks erforderlich sind

[PostgreSQL 18: `pg_restore`](https://www.postgresql.org/docs/18/app-pgrestore.html) erläutert, dass `--no-owner` die ursprüngliche Objekt-Eigentümerschaft **nicht** setzt und `--no-acl` die Wiederherstellung von Zugriffsberechtigungen unterdrückt. Laut [PostgreSQL 18: `pg_dump`](https://www.postgresql.org/docs/18/app-pgdump.html) enthält ein einzelner Datenbank-Dump auch **keine globalen Clusterobjekte** wie Rollen und Tablespaces. Deshalb ist für einen späteren echten Betriebswechsel eine **gesondert autorisierte Rollen-/Rechte-Abbildung** notwendig. Dies ist **keine** Aufforderung, mit `pg_dumpall` globale Secrets oder Rollen im Repository zu exportieren.

Ein erfolgreicher Test der Schema- und Datenkonsistenz kann die Berechtigungs-/Laufzeitabnahme nicht ersetzen. Bis die getrennte Rollenprüfung, Erweiterungs-/Sequenz-/Constraint-Kontrolle und ein ausdrücklich erlaubter isolierter Smoke-Test vorliegen, ist der Restore **noch nicht als produktionsfähig abgenommen**.

## 5. Entscheidung und Evidenz – kein automatisches Gate-Pass

- Die **27 Pflichtfelder** aus `DB_BACKUP_RESTORE_EVIDENCE_TEMPLATE.md` bleiben standardmäßig `OFFEN` oder `NEIN`. Erst nach ausgeführten, belegbaren Betreiberhandlungen darf ein gesondertes, **nicht geheimes** Freigabeprotokoll echte Ergebnisse enthalten; diese Vorlagen-Datei ist keine Ausführungsakte.
- Gate A2 (`DB_NETWORK_ALLOWLIST_OPERATOR_CHECKLIST.md`) bleibt unabhängig **OFFEN**. `0.0.0.0/0` betrifft externe DB-Zugriffe; eine überstürzte Einschränkung vor einem autorisierten Export kann den Backup-Zugang selbst unterbrechen.
- Zeitplan als **Ziel, keine Zusage**: 20.11.2026 Betreiber- und kostenfreie Zielentscheidung; 25.11.2026 autorisierte verschlüsselte Sicherung; 30.11.2026 isolierter Restore; 04.12.2026 endgültige kostenfreie Fortführung klären; 07.12.2026 Stop-/Freigabeentscheidung.
- Erst bei echtem erfolgreichen isoliertem Restore darf Gate C **zur Betreiberabnahme vorgelegt** werden. Selbst danach sind Staging-Isolation, Migrationen, Browser-/OBS-Prüfungen und **Produktivdeploy separat zu genehmigen**.

**GESAMTSTATUS: GESPERRT.** Keine Free-Verlängerung zugesichert, kein Dump/Restore erfolgt, keine Datenbankänderung durchgeführt. Siehe `PRODUCTION_BACKUP_STAGING_GATE.md`, `FREE_POSTGRES_DEADLINE_DECISION.md` und `RELEASE_READINESS_READ_ONLY.md`.
