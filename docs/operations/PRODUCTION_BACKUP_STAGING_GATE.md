# Produktiv-Backup, Restore und Staging-Isolation – Freigabegates

Stand: 14.11.2026. **Nur Planung; keine Produktionszugriffe, Datenexporte, Migrationen oder Deployments.**

## Bekannte Ausgangslage
- Render PostgreSQL `cfs-zockt-db`: Free-Plan, Ablauf laut Render-Konsole am **09.12.2026**. Frühzeitig Fortführung oder kostenfreie Migration mit Betreiber klären; niemals annehmen, dass kostenlose Verlängerung oder Export garantiert sind.
- Read-only-Befund vom 14.11.: bestehende `accounts`-Tabelle, aber kein `schema_migrations`-Ledger und keine MFA-Challenge-Tabelle. Historische Baseline ist **nicht** automatisch erlaubt.
- **Read-only-Render-Befund vom 15.11.2026:** DB `cfs-zockt-db` ist verfügbar, PostgreSQL 18, Free, tatsächlicher Render-Ablauf `2026-12-09T18:36:16Z`. Der DB-`ipAllowList` enthält `0.0.0.0/0` (`everywhere`). Dies erlaubt Netzwerk-Verbindungsversuche aus dem gesamten IPv4-Raum, **nicht** automatisch authentifizierten Datenzugriff. Ohne überprüfte benötigte Verbindungswege und gesonderte Betreiberfreigabe die Allowlist **nicht** live ändern.
- Render-Staging hat derzeit **keine nachgewiesen isolierte Datenbank**. Staging-Dienst und Produktionsdienst haben Auto-Deploy deaktiviert.
- Die CI-Tests nutzen eine **flüchtige, isolierte PostgreSQL-18-Datenbank**. Ihr erfolgreicher Dump/Restore ist kein Nachweis für die echte Produktionsdatenbank.

## Gate A: Betreiberentscheidung vor Ablauf
1. Betreiber bestätigt Eigentümer, zulässige Zugriffsmethode, voraussichtliche Datenmenge, Frist und ein **kostenfreies** Fortführungsziel. Keine Zugangsdaten in GitHub, Tickets oder Logs ablegen.
2. Kein Löschen/Ersetzen der bestehenden Render-DB, kein Upgrade und kein Tarifwechsel ohne gesonderte ausdrückliche Freigabe.
3. Wenn kein kostenloses Ziel oder verifizierter Restore rechtzeitig verfügbar ist: **keinen** riskanten automatischen Umzug starten; Betreiber über Ablauf-/Verfügbarkeitsrisiko informieren.

## Gate A2: Datenbank-Netzwerkzugang risikobewusst eingrenzen (neu 15.11.)

1. Betreiber erfasst **ohne Secrets oder interne Verbindungsstrings** die tatsächlich benötigten DB-Verbindungswege (produktive Render-Web-Services, berechtigter Wartungs-/Backup-Client, eventuelle weitere ausdrücklich autorisierte Clients). Öffentlich erreichbare **Web-Service-URLs** nicht mit DB-Netzwerkregeln verwechseln.
2. Für die derzeit offene IPv4-Allowlist `0.0.0.0/0` einen begründeten Minimalzugangsplan erstellen. Prüfen, ob interne Render-Verbindungen weiterhin erreichbar sind und welche externen festen Adressen überhaupt benötigt werden; dynamische IPs und Recovery-/Notfallzugriffe berücksichtigen.
3. Vor jeder Änderung eine autorisierte, sichere Probe und einen konkreten Rückweg dokumentieren. Die Allowlist erst nach eigener ausdrücklicher Freigabe anpassen; keine produktive Verbindung durch einen ungeprüften Sofort-Fix aussperren.
4. Bis zur dokumentierten Prüfung bleibt dieses Sicherheitsthema **OFFEN**. Eine zugängliche Netzwerkadresse beweist keine fehlende Passwortprüfung, ist aber eine unnötig breite Angriffsfläche, sofern weniger Zugriff benötigt wird.

## Gate B: Echter Sicherungsnachweis
Nur ein autorisierter Betreiber darf eine echte Sicherung erstellen. Das Verfahren muss **nachweisbar**:
- einen konsistenten PostgreSQL-Dump aus der autorisierten Quelle erzeugen, Zugangsdaten nicht ausgeben und den Dump verschlüsselt in einem zugriffsgeschützten, vom Live-Dienst unabhängigen Speicher ablegen;
- Zeitpunkt, PostgreSQL-/Tool-Version, verschlüsselte Dateigröße, SHA-256-Prüfsumme der **verschlüsselten** Datei, Aufbewahrungsort (ohne Secrets) und verantwortliche Person festhalten;
- sensible personenbezogene Daten ausschließlich gemäß Betreiber- und Datenschutzvorgaben behandeln. **Keine** Dumps, Klartext-Exporte, Token oder Verbindungsstrings in das Repository, CI-Artefakte oder Chat hochladen.

## Gate C: Isolierte Wiederherstellung
1. Vor dem Restore schriftlich nachweisen, dass das Ziel eine **separate Wegwerf-Datenbank** ist und keinerlei produktive Verbindung/Anwendung auf dieses Ziel zeigt.
2. Verschlüsselten Dump kontrolliert entschlüsseln und mit kompatiblen PostgreSQL-Werkzeugen in die isolierte DB wiederherstellen. Keine Produktionsmigration dabei ausführen.
3. Restore-Erfolg anhand Exitcodes, Schema-/Tabelleninventar, ausgewählten nichtpersonenbezogenen Zählwerten und Schema-Fingerprint verifizieren. Kein Dateninhalt im Prüfprotokoll.
4. Einmaligen Wiederanlauf-/Rollback-Plan festhalten: wer stoppt den Rollout, welche Anwendungsversion bleibt aktiv, wie wird eine fehlerhafte Ziel-DB verworfen, und wie wird auf die gesicherte Ausgangslage zurückgekehrt?
5. Erst nach dokumentiertem erfolgreichen Restore Gate C als bestanden markieren. Ein erfolgreiches `scripts/test-pg18-backup-restore.sh` in CI genügt ausdrücklich **nicht**.

## Gate D: Staging-Isolation
- Eindeutige getrennte DB-Identitäten für Produktion und Staging belegen, ohne Credentials offenzulegen. Eine andere Datenbankbezeichnung allein reicht nicht, wenn beide auf dieselbe Instanz/Datenbank zeigen.
- Staging benötigt eine eigene Datenbank oder eine vergleichbar **technisch getrennte**, ausdrücklich freigegebene Wegwerf-Umgebung. Die bisherige Staging-Konfiguration gilt bis dahin als gesperrt.
- Keine realen Nutzerdaten in Staging kopieren, solange Datenschutz und Zugriffskontrollen nicht ausdrücklich freigegeben sind.
- Erst danach Staging-Code-Stand, isolierte Migration, Smoke-/Browser-/OBS-Tests und Rollback testen. Kein automatischer Staging-Deploy.

## Gate E: Migration und Produktivfreigabe
1. Nach Gate B/C historischen Schemaabgleich mit `npm run release:preflight` **nur lesend** und dem dokumentierten Legacy-Fingerprint durchführen.
2. Eine 001–021-Baseline nur mit den bestehenden expliziten Opt-ins, nach tatsächlichem Restore-Nachweis und eigener Freigabe; 022–025 **niemals** als ausgeführt markieren, wenn sie fehlen.
3. Neue Migrationen und MFA/Admin-Funktionen erst isoliert testen, danach separate Freigabe und Rollback.
4. Produktivdeploy erst nach allen Gates und ausdrücklicher Betreiberentscheidung. CI-Grün oder ein gemergter PR ersetzen diese Entscheidung nicht.

## Abnahmeprotokoll (ohne Geheimnisse)
| Gate | Status 14.11.2026 | Benötigter Nachweis |
| --- | --- | --- |
| A – kostenfreies Ziel/Frist | Offen | Betreiberentscheidung und Ablaufplan |
| B – echter verschlüsselter Dump | Blockiert | Datum, SHA-256 der verschlüsselten Datei, geschützter Speicher |
| C – isolierter Restore | Blockiert | Wiederherstellungsprotokoll, Schema-/Fingerprint-Abgleich, Rollback |
| D – Staging getrennt | Blockiert | Technischer Trennungsnachweis und Staging-Testfreigabe |
| E – Migration/Deploy | Gesperrt | A–D, Migrationsabnahme, ausdrückliche Freigabe |

**Stop-Regel:** Unbekannte Verbindung, fehlende Sicherung, Schemaabweichung, Restore-Fehler, nicht isoliertes Staging oder unklare Kosten ⇒ **keine** Änderung an Produktion.
