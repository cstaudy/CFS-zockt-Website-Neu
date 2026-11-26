# Verbindliche Codex-Anweisungen fuer CFS Zockt Website 3

## Projektgrenzen

- Ausschliesslich dieses Repository bearbeiten.
- Haushaltsapp und CFScord vollstaendig ausschliessen.
- Keine Produktionsumschaltung, produktiven Datenbankaenderungen, Loeschungen,
  Force-Pushes oder Sicherheitsumgehungen ohne ausdrueckliche Freigabe.
- Geheimnisse, Passwoerter, Tokens, Dumps und private Schluessel niemals in Git,
  Chat, Quellcode oder Diagnoseprotokollen speichern oder ausgeben.

## Arbeitsueberwachung und Wiederherstellung

Vor, waehrend und nach jeder Aufgabe ist der Arbeitszustand aktiv zu pruefen:

1. Repository, Branch, HEAD, Remote-Tracking-Stand und Arbeitsbaum pruefen.
2. Nach Abbruch, Timeout, Sitzungsende oder fehlgeschlagener Dateioperation
   offene Prozesse, Lockdateien, temporare Dateien und unvollstaendige Artefakte
   suchen.
3. `git status`, relevante Diffs, Index/Commit-Zustand und `git diff --check`
   ausfuehren. Bestehende Benutzeränderungen nicht blind ueberschreiben.
4. Dateiänderungen auf Vollstaendigkeit, Parsefehler, leere/trunkierte Dateien
   und widerspruechliche Zwischenstaende pruefen.
5. Backup-Dateien nur als erfolgreich behandeln, wenn Dump, Manifest, Hash-
   Vergleich und die vorgesehene Restore-Pruefung erfolgreich sind.
6. Fehlgeschlagene oder unvollstaendige Sicherungen niemals automatisch als
   gueltig weiterverwenden; vorhandene Artefakte nicht unkontrolliert loeschen.
7. Nach jeder Reparatur passende Syntax-, Funktions- und Regressionstests
   ausfuehren und das Ergebnis nachvollziehbar dokumentieren.
8. Offene Arbeiten, Blockaden, erwartete Eingaben und den sicheren Fortsetzungs-
   punkt in einem Bericht oder der passenden Projektdokumentation festhalten.

## Git- und Aenderungsregeln

- In kleinen, nachvollziehbaren Aenderungen arbeiten.
- Vor Commit und Push nur den beabsichtigten Diff aufnehmen.
- Gepruefte Aenderungen mit aussagekraeftigem Commit sichern.
- Ausschliesslich normale Pushes auf die vorgesehene Branch verwenden.
- Keine destruktiven Git-Befehle wie `reset --hard` oder Force-Push.
- Temporäre Abhaengigkeiten und Testdateien nach der Pruefung entfernen, sofern
  sie nicht Teil des Projekts sind; dabei keine Benutzerdateien loeschen.

## Datenbank- und Backup-Sicherheit

- Produktionszugangsdaten nur ueber geschuetzte lokale Eingaben verarbeiten.
- PostgreSQL-Backups ausserhalb von Git und OneDrive auf nachweislich geschuetz-
  tem lokalen Speicher ablegen.
- `verify-full`, System-CA-Pruefung und BitLocker-Schutz nicht abschwaechen.
- SHA-256-Manifest zwingend erzeugen und vor jeder Restore-Pruefung validieren.
- Restore nur in einer leeren, isolierten, nicht produktiven Datenbank.
- Keine `DROP DATABASE`, `--clean`, Datenbank-Resets oder produktiven Schreib-
  zugriffe als Teil einer Sicherungspruefung.
- Bei nicht verifizierbarem Schutzstatus oder unklarer Datenlage abbrechen und
  den Zustand als BLOCKED melden.

## Website-Master und Qualitaet

- Die Dateien an der Projektwurzel sind der aktuelle Website-Master.
- Vor Codeaenderungen Architektur-, Handover- und relevante Referenzdokumente
  pruefen; keine alten ZIP-Quellen blind uebernehmen.
- Bestehendes CFS-Logo, Markenassets, Standarddesign und responsive Verhalten
  erhalten.
- Keine erfundenen Integrationszustaende, Statistiken oder Originaldesigns.
- Externe APIs und Datenbanken nur als PASS melden, wenn sie tatsaechlich
  verifiziert wurden; sonst BLOCKED oder UNGETESTET dokumentieren.
