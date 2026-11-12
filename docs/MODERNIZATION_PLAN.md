# Modernisierung und Projektstruktur

Status: Planungsphase. Keine produktiven Änderungen durch dieses Dokument.

## Ziele
- Bestehende Funktionen, URLs und Nutzerdaten erhalten.
- Verantwortlichkeiten zwischen HTTP-Routen, Geschäftslogik, Datenzugriff und UI trennen.
- Migrations- und Backup-Prozesse nachvollziehbar, überprüfbar und sicher gestalten.
- Änderungen in kleinen Pull Requests mit grüner CI ausrollen.

## Ist-Zustand (12.11.2026)
- Repository: cstaudy/CFS-zockt-Website-Neu.
- GitHub PR #49 ist nach erfolgreicher PostgreSQL-18-CI-Prüfung in main.
- Render-Produktivdatenbank: PostgreSQL 18, 26 Tabellen im Schema public.
- Auf Render fehlen schema_migrations, die vier MFA-Erweiterungsspalten und mfa_login_challenges.
- Ein echter Produktions-Dump mit isoliertem Restore ist noch nicht nachgewiesen.
- Der vorhandene CI-Restore-Test ist absichtlich auf eine flüchtige lokale CI-Datenbank beschränkt.

## Zielstruktur (schrittweise, nicht als sofortiger Massenumzug)
- `src/config/`: validierte Konfiguration und Laufzeitumgebung
- `src/db/`: Datenbankverbindung, Repository-Funktionen, Migrationen
- `src/modules/<feature>/`: fachliche Module (Accounts, MFA, Creator, Medien)
- `src/http/`: Routing, Middleware, Request-/Response-Grenzen
- `public/`: statische Assets
- `scripts/`: klar getrennte Betriebs- und Wartungsskripte
- `tests/unit/`, `tests/integration/`, `tests/e2e/`: Tests nach Ebene
- `docs/operations/`: Backup, Restore, Deployment, Recovery

Dies ist ein Zielbild. Bestehende Pfade bleiben zunächst gültig, bis ihre Abhängigkeiten geprüft sind.

## Umsetzung in separaten Pull Requests
1. **Bestandsaufnahme:** Einstiegspunkte, Skripte, Routen, Abhängigkeiten, Testabdeckung und Datenbankobjekte inventarisieren; Ausgangsverhalten festhalten.
2. **Sicherheits- und Konfigurationsgrenzen:** Secrets niemals loggen, Umgebungen strikt trennen, Konfiguration validieren; keine Produktionsverbindungen in Tests.
3. **Datenbank-Betrieb:** dokumentierter read-only Dump, verschlüsselter und zugriffsgeschützter Speicher, SHA-256-Prüfung, Restore in getrennte Datenbank, Schema-/Datenvergleich. Kein automatisches Produktionsupgrade.
4. **Migrationen:** nur nach erfolgreich verifiziertem Restore und ausdrücklicher Freigabe historische Baseline 001–021 prüfen; MFA 022–025 separat testen und freigeben.
5. **Backend modularisieren:** zunächst eine Funktion nach der anderen mit Regressionstests extrahieren; API-Verträge beibehalten.
6. **Frontend ordnen:** Assets, Komponenten, Styles und Accessibility prüfen; schrittweise verbessern, keine ungetestete Neugestaltung.
7. **CI und Betrieb:** Unit-/Integration-/E2E-Gates, Sicherheitsprüfungen, Staging-Deploy, Rollback-Runbook und Monitoring.

## Verbindliche Freigaberegeln
- Kein direkter Push auf main: Änderungen über Pull Requests.
- Kein Render-Produktivdeploy, kein Tarifwechsel und keine Änderung produktiver Umgebungsvariablen ohne gesonderte Freigabe.
- Keine produktive Migration, kein DROP, kein RESTORE gegen die Quell-Datenbank.
- Vor produktiven Schemaänderungen: echter Dump, Restore in isolierte Instanz, Integritätsprüfung, Rollbackplan und ausdrückliche Freigabe.
- Für jede Umstrukturierung: grüne CI und dokumentierte Kompatibilitätsprüfung.

## Abnahmekriterien
- Alle bestehenden Endpunkte und Kernfunktionen bleiben kompatibel.
- Die Tests sind reproduzierbar und nutzen ausschließlich Testdaten.
- Backup und Restore sind mit echtem Snapshot in einer isolierten Umgebung nachgewiesen, bevor produktive Migrationen stattfinden.
- Betrieb, Recovery und Deployment sind für Dritte nachvollziehbar dokumentiert.
