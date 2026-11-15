# Entwicklungsplan – Upload-Auslieferung und sichere Releases

Stand: 14.11.2026. Kostenrahmen: nur bestehende GitHub-Actions-CI, keine neue kostenpflichtige Render-Datenbank.

| Priorität | Aufgabe | Status / Nachweis |
| --- | --- | --- |
| P0 | Upload-Auslieferung: `nosniff` für alle Dateiendungen | Implementiert auf diesem Branch, CI für HEAD noch prüfen |
| P0 | Creator-Quota-Eingaben absichern | PR #89, CI grün, Draft nicht gemerged |
| P0 | Produktions-Backup und isolierten Restore nachweisen | Blockiert, kein echtes Backup bestätigt |
| P0 | PostgreSQL-Migrationshistorie/Legacy-Baseline klären | Produktions-DB ohne Ledger, keine Schreibzugriffe freigegeben |
| P1 | Upload-Header in realen Browsern und bei Altdateien prüfen | Offen; Unit-Test ersetzt Browserprüfung nicht |
| P1 | Isolierte PostgreSQL-18-Migrationstests in GitHub Actions weiterführen | Vorhandene CI, bei jedem PR erneut prüfen |
| P2 | Render-Staging nur mit unabhängiger DB | Blockiert: zweite kostenlose Render-DB abgelehnt |

## Vorgehen und Rollback
Nach jedem Code-Update Übergabe + Entwicklungsplan im selben Branch, CI des letzten HEAD prüfen, nur nach Review mergen. Keine Produktionsmigration, kein Render-Deploy, kein zusätzlicher Tarif. Bei Browserregression den kleinen Header-Commit revertieren. Als nächste Aufgabe die tatsächliche Header-Anwendung in der HTTP-Auslieferung und den Testumfang prüfen.

## Nachprüfung des bestehenden PR #90
- HEAD `2b328c7` erfolgreich in GitHub Actions (Run `43625825079`), ohne Merge-Konflikte. Reine Headerhärtung, kein Datenbankzugriff.
- Review kann beginnen; kein Merge ohne ausdrückliche Freigabe. Browser-E2E bleibt optionaler, vor Deployment nachzuholender Nachweis.

## Review-Gate PR #90
- CI für `5dbfbeb` grün (Run `43638853771`); PR #90 jetzt review-bereit.
- Offene Abnahme: Reviewer bestätigt Headerverhalten; realer Browser-Test vor Deployment; explizite Mergefreigabe bleibt erforderlich.
- Nach dieser Dokumentationsänderung neue CI prüfen. Keine weiteren Änderungen ohne Befund.

## Nächste Abnahme: tatsächlicher HTTP-Uploadpfad
- Quellcode verifiziert: `server.js` nutzt `uploadDeliveryHeaders(filePath)` bei `res.writeHead(200)` für Uploads, für GET und HEAD.
- Bestehender HTTP-Test prüft `401` für anonyme Uploads, aber noch keinen authentifizierten `200`-Response mit `nosniff` und Legacy-`attachment`.
- Vor produktivem Deployment in isolierter Testumgebung mit Test-DB und Auth-Fixture HTTP-Header für Bild/Video/Legacy jeweils mit GET und HEAD prüfen. Kein Zugriff auf Prod-Daten, keine Freigabe durch grünen Unit-Test allein.
- PR #90 HEAD `bb56976` CI grün (Run `43639049229`); neue reine Dokumentations-CI prüfen.

## Isolierter HTTP-200-Test – Voraussetzungen
- `serveStatic()` lässt Upload-HTTP-200 nur nach DB-gestützter Veröffentlichung oder Eigentums-/Authentifizierungsprüfung zu. Ohne Test-DB ist der sichere Integrationstest nicht realisierbar; Autorisierung keinesfalls lockern.
- Testplan: ephemeres PG18 mit Migrationsschema; eigenes Testkonto, Session und Asset-Datei; GET/HEAD auf bekanntes Bild und Legacy-Datei; `nosniff`, MIME, `attachment`, `private, no-store` und Fremdzugriff prüfen; danach DB und Dateien entsorgen.
- Aktueller HEAD `088d8b0` CI grün (Run `43639293520`); keine Änderung an Auth-Logik oder Produktionsinfrastruktur.

## HTTP-Header-Test in bestehende kostenlose CI integriert
- Bereits vorhandene PG18-CI führt echte authentifizierte HTTP-GET/HEAD-Tests mit Testkonto und Testdateien aus; Legacy-`.html` wurde schon mit `nosniff`/`attachment` geprüft. Vorherige Beschreibung als komplett fehlender HTTP-200-Test korrigiert.
- Ergänzt: `scripts/test-account-creator-flow.mjs` prüft für normale Bild-/Video-Uploads nun auch `nosniff` und erwarteten MIME auf GET/HEAD (Commit `6a661eb`).
- Nächster Gate: neuer CI-Lauf muss grün sein; manueller Browser-Test vor Produktionsfreigabe bleibt offen. Kein Merge/Deploy ohne Freigabe.

## CI-Abnahme: authentifizierte Upload-Header
- HTTP-Regression für Bild/Video GET+HEAD (`6a661eb`) in GitHub Actions `43639925962` **erfolgreich**, inklusive ephemerem PG18.
- Bestehende Legacy-`.html`-GET/HEAD-Tests sichern `nosniff`, `attachment` und binäre Auslieferung ab.
- Noch offen: Review-/Mergeentscheidung und manueller Browser-Test vor Deployment. Der nachfolgende Dokumentations-HEAD benötigt ebenfalls erfolgreiche CI.

## Abhängigkeiten zwischen den drei review-bereiten PRs
- #89 und #90 berühren beide `scripts/test-account-creator-flow.mjs`, jedoch verschiedene Abschnitte. Zusammenführbarkeit muss nach **jedem** autorisierten Merge durch neue CI auf `main` nachgewiesen werden; Einzel-PR-Grün allein genügt nicht.
- #91 fügt Dokumentations-/Release-Gates und `npm run check`-Guard hinzu; kein direkter Dateiüberschneidungsbefund mit #89/#90.
- Alle drei PRs auf aktuellem Stand clean und grün (#90 `502625f`, CI `43640019169`). Keine Reihenfolge ist freigegeben; ohne ausdrückliche Zustimmung kein Merge.

## Hunk-basierte Integrationsbewertung
- #89 fügt Tests um Basiszeile 772 hinzu; #90 fügt Headerprüfungen um Basiszeile 890 derselben Datei hinzu. Keine überschneidenden Patch-Kontexte; voraussichtlich textuell kompatibel.
- Nicht als kombinierten Test oder Merge-Beweis werten. Erst nach ausdrücklich autorisiertem Merge CI auf aktualisiertem `main` abwarten und ggf. Folge-PR rebasen/neu prüfen.
- PR #90 letzter erfolgreich getesteter Stand `305d179`, Run `43644681889`. Review/Browser/Produktions-Gates bleiben unverändert offen.

## Öffentliche Widget-Bilder: zusätzliche HTTP-Abnahme
- Bestehende PG18-CI testet veröffentlichte OBS-Bilder ohne Login und private Videos weiterhin mit `401`. Neuer Test `acc3f5e` verlangt auf öffentlich freigegebenen Bildern bei GET+HEAD zusätzlich `x-content-type-options: nosniff` und `content-type: image/png`.
- Keine produktive Freigabe oder neue Route. Nächster Schritt: GitHub Actions für den neuen Commit kontrollieren; manueller Browser-Test vor Deployment weiterhin offen.

## Widerruf öffentlicher Widget-Bilder
- Neuer E2E-Test `7ee294f`: Ein zuvor veröffentlichtes OBS-Bild muss nach Wechsel auf `private` anonym bei GET **und** HEAD `401` sowie `cache-control: no-store` liefern.
- Vorheriger HEAD `9ae94ff` war grün (Run `43701057296`). Aktuelle CI abwarten; Browser-/Merge-/Backup-Gates bleiben offen.

## Nächste Regression: anonyme HEAD-Anfragen
- Implementiert in `3b04c82`: Fremd-Account kann eigenes veröffentlichtes Widget nicht zum Zugriff auf fremdes Bild verwenden; eigener Draft gibt Bild nicht anonym frei. Beide Fälle nun bei GET und HEAD mit `401` + `no-store` geprüft.
- Vorheriger Widerrufs-Test `7ee294f` war grün (Run `43701127023`). Nächste Aufgabe: neuen CI-Lauf abwarten und bei Fehlschlag gezielt korrigieren; anschließend Review, manuelle Browserabnahme, nur mit ausdrücklicher Freigabe Merge/Deployment.

## Nächster Security-Check: negative HTTP-Antworten
- `5740633` erweitert die vorhandene GET/HEAD-Bild-/Video-Matrix für `401` (anonym) und `404` (fremder Creator) um `no-store` und `nosniff`.
- Ziel: Keine private Medienantwort und auch keine abgewiesene Anfrage darf zwischengespeichert oder MIME-gesnifft werden. CI für neuen Commit abwarten, ggf. Fehler beheben. Danach Review und nur nach ausdrücklicher Freigabe Merge; Browser-/Backup-/Staging-Gates bleiben bestehen.

## Löschpfad: Schutz vor Wiederabruf
- E2E-Erweiterung `0341ac3` sichert nach erfolgreicher Video-Löschung die ehemalige URL bei authentifiziertem GET+HEAD mit `404`, `no-store`, `nosniff` ab. Physisches Entfernen der Datei wird weiterhin geprüft.
- Vorheriger HEAD `469d941` grün (CI `43701356829`). Nächster Schritt: CI des neuen Testcommits und Dokumentations-HEAD prüfen, Fehler ggf. korrigieren. Review, Browserabnahme und Backup-/Staging-Gates vor Produktionsfreigabe bleiben offen.

## Testmatrix nach Video-Löschung
- `304f841` erweitert den Löschpfad auf sechs Fälle: 3 Rollen (anonym/foreign/owner) × 2 Methoden (GET/HEAD). Erwartet `401/404/404` und jeweils `no-store` + `nosniff`.
- Vorherige CI `43701460576` grün. Nächster Schritt: neuen CI-Lauf prüfen, eventuelle Abweichungen beheben; anschließend Review und Freigabeentscheidung. Browser-, Backup-/Restore- und Staging-Gates bleiben offen.

## Rechte-Isolation bei veröffentlichten OBS-Bildern
- Neuer Test `2990c74`: Eine veröffentlichte Bildreferenz darf nicht versehentlich das private Video desselben Creators freigeben. Anonymes GET+HEAD auf Video muss `401`, `no-store` und `nosniff` liefern.
- Vorherige Löschtest-CI `43701694175` grün. Nächste Schritte: neuen CI-Lauf kontrollieren, dann Review; Browser-/Backup-/Staging-Gates und explizite Mergefreigabe bleiben offen.

## Widerruf ohne Datenverlust für Eigentümer
- `9b0546f` ergänzt nach `published → private` eine positive GET/HEAD-Owner-Regression: `200`, `private, no-store`, `nosniff`, `image/png` und Originalbytes. So wird zwischen anonymer Sperre und weiterhin gültigem Eigentümerzugriff unterschieden.
- Nächste Schritte: CI des aktuellen HEAD abwarten und ggf. korrigieren; PR #90 reviewen. Keine Merge-/Deploy-/Produktionsfreigabe; Backup/Staging und Browserabnahme weiter offen.

## Abgewiesene Fremdlöschung ohne Seiteneffekt
- `3bd311e`: Nach fremdem DELETE (`404`) bleibt das Video für den Eigentümer per GET/HEAD (`200`) vollständig erhalten, inklusive Cache-/MIME-Header und Bytegleichheit. Anschließend bleibt die reguläre Löschung samt physischer Entfernung getestet.
- Vorheriger HEAD `dc5eee2` grün (`43701848825`). Nächste Schritte: CI für neuen Code-/Dokumentations-HEAD kontrollieren, ggf. korrigieren; danach Review. Merge, Deployment, produktive DB-Migration und kostenpflichtige Ressourcen bleiben ohne Freigabe gesperrt.

## Löschwiederholung: Zustand bleibt gesperrt
- `2848633` prüft nach wiederholtem DELETE (`404`) nochmals physisches Fehlen (`ENOENT`) und Owner GET/HEAD (`404`, `no-store`, `nosniff`).
- Vorheriger HEAD `db7f214` grün (CI `43702065644`). Als Nächstes neue CI und Dokumentations-HEAD prüfen, dann Review. Kein Merge/Deploy ohne Freigabe; Browser- und Backup-/Staging-Gates weiterhin offen.
