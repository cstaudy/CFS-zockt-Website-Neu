# Entscheidungsvorlage: PostgreSQL-Free-Ablauf am 09.12.2026

Stand: 15.11.2026. **Keine Änderung an Render oder der Produktionsdatenbank.**

## Entscheidung, die der Betreiber treffen muss
Die schreibgeschützte Render-Abfrage vom 15.11.2026 bestätigt `cfs-zockt-db` als verfügbar (PostgreSQL 18, Free) und nennt **09.12.2026, 18:36:16 UTC** als konkreten Ablauf. Zugleich ist die DB-IPv4-Allowlist mit `0.0.0.0/0` offen; das ist **kein Nachweis eines unauthentifizierten Zugriffs**, verlangt aber eine von befugtem Betreiber geplante Einschränkungs-/Kompatibilitätsprüfung, ohne laufende Clients auszusperren. Das bedeutet nicht, dass eine kostenfreie Verlängerung verfügbar ist. Rechtzeitig vor diesem Datum muss der Betreiber eine tatsächlich verfügbare, zulässige und **kostenfreie** Fortführungsoption bestätigen. Ohne diese Bestätigung keine automatische Migration, keine Löschung und kein riskanter Wechsel.

## Optionen – nur nach Verifikation

| Option | Voraussetzung | Hauptrisiko | Entscheidung |
| --- | --- | --- | --- |
| A: Weiterbetrieb bei Render | Nur bei belegter **Ausnahme** oder nachweislich verfügbarem kostenfreiem Angebot; Render dokumentiert **keine reguläre Free-Verlängerung** | 30-Tage-Ablauf; nur ein aktives Free-Postgres pro Workspace; kein gesicherter Ersatz in demselben Workspace | Nicht nachgewiesen |
| B: Wechsel zu anderem kostenlosen PostgreSQL-Ziel | Aktuelles Angebot, Kontingente, Datenschutz/Region, Verbindungssicherheit, Betriebsgrenzen und Restore vorher nachweisen | Datenmigration, Ausfallzeit, Einschränkungen, mögliches späteres Pricing | Offen |
| C: Kontrollierte Stilllegung mit gesichertem Export | Echter verschlüsselter Dump, isolierter Restore und geklärte Datenaufbewahrung | Website-/Account-Funktionen ohne DB nicht verfügbar | Nur nach ausdrücklicher Betreiberentscheidung |
| D: Kostenpflichtiger Tarif | **Nicht innerhalb des vereinbarten kostenlosen Entwicklungsrahmens** | Zusätzliche Kosten | Nicht autorisiert |

Keine Option ist durch diese Tabelle als verfügbar oder technisch erfolgreich bestätigt. Besonders bei kostenlosen Drittanbietern dürfen keine Garantien zu Speicher, Dauer, Datenschutz oder Importfähigkeit angenommen werden.

## Bestätigte Render-Free-Grenzen (offizielle Dokumentation, geprüft am 15.11.2026)

- Free-PostgreSQL endet regulär **30 Tage nach Erstellung** und wird danach **unzugänglich**. Die folgende **14-tägige Kulanzfrist** dient laut Render einer **kostenpflichtigen Hochstufung**, nicht einer weiteren kostenlosen Betriebsperiode. Anschließend löscht Render die Datenbank samt Daten. **Nicht bis zur Kulanzfrist mit einem kostenlosen Datenexport warten.**
- Pro Render-Workspace darf nur **eine aktive Free-Postgres-Datenbank** existieren. Eine zweite gleichzeitig laufende kostenlose Render-Datenbank ist daher **keine nachgewiesene Staging- oder Migrationsoption**. Die bestehende Datenbank zum Freimachen eines Slots zu löschen ist **nicht zulässig**.
- Render bietet für den Free-Compute-Plan **weder automatische logische Exporte noch Point-in-Time-Recovery** an. Die offizielle kostenlose Exportmöglichkeit ist ein `pg_dump` durch einen **autorisierten Betreiber vom eigenen Client**, solange die Datenbank erreichbar und zugänglich ist. Die Sicherung muss separat verschlüsselt und durch einen Restore in isolierter Umgebung geprüft werden; weder Befehl noch Sicherung wurden hier ausgeführt.
- Die DB-Allowlist beschränkt laut Render **externe** Verbindungen; interne Verbindungen vom berechtigten Render-Service im selben Workspace/in derselben Region über die interne URL werden dadurch nicht geregelt. **Vor** jeder Einschränkung prüfen, ob die produktive Anwendung tatsächlich den internen oder den externen Verbindungsweg verwendet. Keine DB-URLs oder Secrets veröffentlichen.
- Angaben basieren auf [Render: Deploy for Free](https://render.com/docs/free), [Render: Postgres Recovery and Backups](https://render.com/docs/postgresql-backups) und [Render: Create and Connect to Render Postgres](https://render.com/docs/postgresql-creating-connecting). Anbieterbedingungen können sich ändern; bei der Betreiberentscheidung erneut prüfen.

**Konsequenz:** Betreiber soll den authorisierten, konsistenten `pg_dump` **rechtzeitig vor dem 09.12.2026** einplanen; Planungsziel **25.11.** bleibt bestehen. Ohne unabhängige Sicherung und getesteten isolierten Restore besteht ein reales Datenverlustrisiko. Ein kostenpflichtiges Upgrade ist **nicht autorisiert** und darf nicht stillschweigend erfolgen.

## Rückwärtsplanung

| Bis spätestens | Ergebnis |
| --- | --- |
| 20.11.2026 | Betreiber bestätigt Verantwortliche, zulässige Exportmethode, verfügbare kostenlose Optionen und benötigte Datenmenge |
| 25.11.2026 | Verschlüsselten echten Dump **durch autorisierten Betreiber** erstellen; Prüfsumme und unabhängigen Speicher nachweisen |
| 30.11.2026 | Wiederherstellung in technisch isolierter Wegwerf-Datenbank nachweislich erfolgreich; Restore- und Rollback-Protokoll |
| 04.12.2026 | Kostenfreies Fortführungsziel samt Limits, Datenschutz, Verbindung und Staging-Isolation entscheiden |
| 07.12.2026 | Letzte Freigabe-/Stop-Entscheidung mit ausreichend Puffer vor dem 09.12.2026 |

Diese Daten sind **Planungsziele**, keine automatisierten Termine, Reservierungen oder Zusagen. Bei früheren Render-Fristen entsprechend vorziehen.

## Minimaler Betreiber-Nachweis (ohne Geheimnisse)
- Zeitpunkt und verantwortliche Rolle; **keine** Passwörter, DB-URLs, Tokens oder personenbezogene Datensätze.
- Status und bestätigte Bedingungen der kostenlosen Zieloption; keine unbelegten Marketing-Aussagen.
- Backup: verschlüsseltes Artefakt in unabhängigem geschütztem Speicher, SHA-256 der verschlüsselten Datei, geprüfte Lesbarkeit.
- Restore: isolierte Zielidentität, erfolgreiches Importprotokoll, Tabellen-/Schema-Inventar, erwartete Zählwerte nur aggregiert, dokumentierter Rollback.
- Freigabe: getrennte Entscheidungen für Datenbankwechsel, Migrationen, Staging und Produktivdeployment.

## Zusätzlicher Betreiberpunkt: DB-Netzwerkfreigabe (15.11.2026)

- Eintrag `0.0.0.0/0` betrifft die **Datenbank-Allowlist**, nicht die HTTP-Freigabe des Web-Services. Netzwerkzugang allein hebt PostgreSQL-Authentifizierung nicht auf.
- Bis zur Betreiberentscheidung am **20.11.2026** dokumentieren, welche produktiven internen und berechtigt externen Verbindungen tatsächlich gebraucht werden und wie vor einer Begrenzung Rückfall-/Notfallzugriff geprüft wird.
- Keine sofortige IP-Sperrung oder Änderung der Render-Einstellungen: falsche Einschränkungen könnten Produktivdienst oder autorisierte Backups aussperren. Eigenständige Freigabe erforderlich. Das Abnahmeprotokoll erhält ein weiteres Pflichtfeld und bleibt **GESPERRT**.

## Konkrete Stop-Kriterien
- Kein echter Restore-Nachweis oder nur ein erfolgreicher CI-Dump/Restore.
- Staging verwendet dieselbe Produktionsdatenbank.
- Ungeklärte Kosten oder Datenschutzbedingungen des Zielanbieters.
- Unvollständiges historisches Schema-/Migrationsledger (`schema_migrations` fehlt laut Read-only-Befund).
- Unklarer Rollback, fehlende Betreiberberechtigung oder fehlende ausdrückliche Freigabe.

## Sichere Fortsetzung
1. Bestehende Release-Gates in `docs/operations/PRODUCTION_BACKUP_STAGING_GATE.md` beibehalten.
2. Betreiberentscheidung und verifizierte, **nicht geheime** Nachweise in einem gesonderten Freigabeprotokoll erfassen.
3. Erst danach technische Migrations-/Restore-Runbooks für das **konkret bestätigte** Ziel ausarbeiten.
4. Ohne Nachweise und Freigabe bleiben Produktion, Render-Konfiguration und Staging unverändert.
