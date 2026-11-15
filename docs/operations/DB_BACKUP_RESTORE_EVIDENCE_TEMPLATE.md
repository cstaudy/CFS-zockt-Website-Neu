# Abnahmeprotokoll: Produktionsbackup und isolierter Restore (Vorlage)

Stand: 15.11.2026. **Unbefüllte Vorlage, kein durchgeführter Backup-/Restore-Test.** Dieses Dokument darf nur **nicht geheime** Metadaten enthalten. Keine DB-URLs, Passwörter, personenbezogenen Daten, Dumps, Schlüssel oder personenbezogene Tabelleninhalte eintragen.

## A – Verantwortlichkeit und Kosten

| Feld | Betreiber-Eintrag |
| --- | --- |
| Freigebende Rolle / Kontaktkanal (keine privaten Kontaktdaten) | OFFEN |
| Render-Free-Ablauf laut Konsole | 09.12.2026 |
| Kostenfreie Zieloption und verbindlich geprüfte Bedingungen | OFFEN |
| Kostenprüfung (0 zusätzliche EUR bestätigt?) | NEIN – nicht nachgewiesen |
| Export-/Restore-Zugriffsberechtigung geprüft? | NEIN – nicht nachgewiesen |
| DB-Netzwerkzugang und erforderliche Client-Ausnahmen geprüft? | NEIN – nicht nachgewiesen |
| Datenschutz-/Aufbewahrungsfreigabe? | NEIN – nicht nachgewiesen |

## B – Sicherung

| Feld | Betreiber-Eintrag |
| --- | --- |
| Sicherungszeitpunkt (UTC) | OFFEN |
| PostgreSQL-Server- und Client-Hauptversion | OFFEN |
| Konsistentes Dump-Verfahren und Exitcode | OFFEN |
| Verschlüsselung nach Betreiberstandard bestätigt? | NEIN – nicht nachgewiesen |
| Speicherort unabhängig von Render, Zugriff beschränkt (nur allgemeine Beschreibung) | OFFEN |
| SHA-256 des **verschlüsselten** Artefakts | OFFEN |
| Lesbarkeit und Aufbewahrungsdauer geprüft? | NEIN – nicht nachgewiesen |

## C – Isolierter Restore

| Feld | Betreiber-Eintrag |
| --- | --- |
| Isolierte Zielumgebung nachweislich getrennt von Produktion? | NEIN – nicht nachgewiesen |
| Ziel als Wegwerf-DB bestätigt, keine produktiven Clients verbunden? | NEIN – nicht nachgewiesen |
| Restore-Zeitpunkt (UTC), Exitcode, verwendete Tool-Version | OFFEN |
| Tabellen-/Schema-Inventar gegen Quelle geprüft (ohne Datensätze)? | NEIN – nicht nachgewiesen |
| Unkritische aggregierte Zählwerte plausibel? | NEIN – nicht nachgewiesen |
| Schema-Fingerprint geprüft? | NEIN – nicht nachgewiesen |
| Restore-/Rollback-Verantwortliche und Abbruchweg dokumentiert? | NEIN – nicht nachgewiesen |

## D – Staging und Migration

| Feld | Betreiber-Eintrag |
| --- | --- |
| Staging-DB-Identität technisch verschieden von Produktion? | NEIN – nicht nachgewiesen |
| Staging-Datenherkunft und Zugriffskontrolle freigegeben? | NEIN – nicht nachgewiesen |
| Read-only-Preflight ausgeführt und dokumentiert? | NEIN – nicht nachgewiesen |
| Historisches Ledger/Schema vollständig geklärt? | NEIN – nicht nachgewiesen |
| Migration 001–021-Baseline separat freigegeben? | NEIN |
| Migration 022–025 separat freigegeben? | NEIN |
| Produktionsdeploy separat freigegeben? | NEIN |

## Ergebnis und Stop-Regel

**Gesamtstatus: GESPERRT.** Ein Feld darf erst nach einem echten, durch den autorisierten Betreiber bestätigten Nachweis auf „JA“ geändert werden. Ein grüner GitHub-Actions-Lauf, eine Datei mit dieser Vorlage oder ein theoretisch ausführbarer Befehl zählt nicht als Produktionsnachweis.

Sobald ein Pflichtfeld OFFEN/NEIN bleibt, **kein** Produktionsdeploy, keine Baseline, keine Migration und kein Staging-Deploy. Eine Änderung der Freigaben erfolgt separat und ausdrücklich durch den Betreiber.

Verwandte Dokumente: `PRODUCTION_BACKUP_STAGING_GATE.md`, `FREE_POSTGRES_DEADLINE_DECISION.md`, `RELEASE_READINESS_READ_ONLY.md`.
