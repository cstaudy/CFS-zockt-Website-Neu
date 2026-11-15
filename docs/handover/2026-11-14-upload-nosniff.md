# Übergabe – Upload-Auslieferung ohne MIME-Sniffing

Stand: 14.11.2026. Branch `security/upload-delivery-nosniff-2026-11-14` (von `main`).

## Änderung
`src/upload-media-policy.js`: `uploadDeliveryHeaders()` liefert `X-Content-Type-Options: nosniff` für bekannte Bild-/Videotypen und unbekannte Legacy-Dateiendungen. Letztere bleiben als `application/octet-stream` mit `Content-Disposition: attachment` ausgeliefert. Die Funktion dient der sicheren Auslieferung gespeicherter Uploads und ersetzt keine Dateidekodierung oder Virenprüfung.

`scripts/test-upload-media-policy.mjs`: Regressionstests für den Header bei bekannten und unbekannten Endungen. Bestehende MIME- und Attachment-Erwartungen bleiben erhalten.

## Risiko / Abnahme
Browser dürfen Uploads nicht mehr als abweichende Typen interpretieren. Dies kann bisher nur durch Browser-Sniffing funktionierende fehlerhaft gespeicherte Dateien beeinflussen; das ist sicherheitsseitig erwünscht. Vor Freigabe CI auf dem endgültigen HEAD prüfen, danach Browser-/OBS-Tests bei Gelegenheit. Keine DB-Migration, kein Deployment, keine Secret-Änderung. Rollback: PR nicht mergen bzw. Commit revertieren.

## Status
Code und Tests committet; CI-Nachweis für diesen neuen Branch bei Erstellung noch ausstehend. PR #89 bleibt separat als Draft, seine CI war für HEAD `c761adb` erfolgreich.

## Nachprüfung am 14.11.2026
- Vollständiger PR #90 HEAD `2b328c7` CI **success** (Run `43625825079`), GitHub mergeable/clean. Änderung auf vier Dateien begrenzt: Headerfunktion, Unit-Test, Übergabe, Plan.
- Die Änderung setzt `nosniff` für alle ausgelieferten Upload-Dateitypen und belässt unbekannte Endungen bei `application/octet-stream` plus Download-Anweisung.
- Kein Browser-E2E-Nachweis; Review offen, kein Merge/Deploy ohne ausdrückliche Zustimmung. PR #89 und #91 ebenfalls offen.

## Review-Status aktualisiert
- Letzter vollständiger HEAD `5dbfbeb`: GitHub Actions Run `43638853771` erfolgreich, mergeable/clean.
- PR #90 von Draft auf **Ready for review** gestellt; **kein Merge**. Reviewer sollen insbesondere Header für bekannte Medien und unbekannte Legacy-Dateien sowie Browser-Verhalten prüfen.
- Dieser Dokumentations-Commit erfordert erneute CI; vor Merge neuen HEAD prüfen. Keine Render- oder DB-Aktion.

## Prüfung des echten HTTP-Pfads (Quellcode und bestehende Tests)
- HEAD `bb56976` grün, CI Run `43639049229`, PR #90 review-bereit/clean.
- `server.js` übergibt in der statischen Dateiauslieferung für `isUpload` die Header aus `uploadDeliveryHeaders(filePath)` unmittelbar an `res.writeHead(200, ...)`; `HEAD` nutzt denselben Headerpfad vor `res.end()`.
- `scripts/test-upload-media-policy.mjs` prüft die Headerfunktion direkt. `scripts/test-static-boundary.mjs` prüft dagegen für `GET` und `HEAD` nur den unauthentifizierten Uploadzugriff (`401`); ein authentifizierter HTTP-200-Upload-Header-Test fehlt.
- **Grenze:** Kein realer HTTP-200-/Browser-Nachweis für authentifizierte Uploads. Ein solcher Test benötigt eine isolierte Test-DB und kontrollierte Authentifizierung; niemals Produktionsdatenbank oder öffentliche Uploads verwenden. Kein Code-/Teständerungsbedarf ohne gesicherten Fixture-Ansatz.

## Isolationsprüfung für HTTP-200-Test
- CI HEAD `088d8b0` erfolgreich (Run `43639293520`).
- `server.js:serveStatic()` verlangt vor dem erfolgreichen Upload-Response einen Datenbank-Nachweis: veröffentlichte Widget-/Scene-Referenz oder authentifiziertes Konto mit `creator_assets`-/`user_media`-Eigentum. Ohne `DATABASE_URL` ist kein erfolgreicher Upload-Abruf möglich; bestehender `test-static-boundary.mjs` bestätigt daher absichtlich nur `401` für GET/HEAD.
- **Kein Umgehen der Autorisierung zu Testzwecken.** Integrationstest für `200` nur mit isoliertem ephemerem PostgreSQL, Testkonto, Test-Asset und anschließendem Cleanup; keine Prod-Verbindung oder Test-Bypass-Route. Vorhandene CI-PG18-Infrastruktur kann dafür später wiederverwendet werden.
- Review-Entscheidung: Sicherheitsheader-Unit-Test plus Codepfad sind grün; echter authentifizierter HTTP-200-Nachweis bleibt offen und muss vor produktiver Freigabe erfolgen. Kein Merge/Deploy ohne explizite Zustimmung.

## Korrektur und echter HTTP-Regressionstest
- Bestehende ephemere PG18-CI unter `.github/workflows/check.yml` führt bereits `scripts/test-account-creator-flow.mjs` aus: echte Testkonto-Registrierung, Uploads und authentifizierte GET/HEAD-HTTP-200-Abrufe. Zudem war für Legacy-`.html` bereits `nosniff` plus `attachment` im HTTP-Test abgedeckt. Die frühere Aussage, es fehle **jeder** authentifizierte HTTP-200-Test, war daher ungenau.
- Commit `6a661eb` ergänzt nun im bestehenden isolierten HTTP-Test für bekannte Bild-/Video-Uploads die Prüfung von `x-content-type-options: nosniff` und `content-type` auf GET und HEAD. Keine Test-DB neu erstellt, keine Auth-Änderung, keine Produktionsverbindung.
- CI dieses Commits prüfen; bei Grün ist die konkrete Header-Regression über echten HTTP-Pfad (bekannt + Legacy) nachgewiesen, nicht jedoch ein manueller Browser-Test.

## HTTP-Integrationstest bestätigt
- Test-Commit `6a661eb`: GitHub Actions Run `43639925962` **success**, einschließlich isoliertem PostgreSQL-18-Creator-End-to-End.
- Reale authentifizierte HTTP-200-GET/HEAD-Antworten für Bild/Video prüfen nun `nosniff` und den jeweiligen MIME-Typ. Vorhandene Legacy-`.html`-HTTP-Tests prüfen `attachment`, `application/octet-stream` und `nosniff`.
- Dokumentations-HEAD `b69fcdc` bei letzter Prüfung noch in CI; nur grüner HEAD darf als abgeschlossen gelten. Browserprüfung bleibt als separates Deployment-Abnahmekriterium offen.
- PR #90 bleibt review-bereit und ungemergt; keine Render-/Produktionsaktion.

## Cross-PR-Review #89 / #90 / #91
- PR #90 HEAD `502625f`: GitHub Actions `43640019169` **success**, mergeable/clean, Ready for review. Auch PR #89 und #91: grün und clean.
- Dateidiff-Abgleich: #89 und #90 ändern beide `scripts/test-account-creator-flow.mjs`, aber unterschiedliche Testabschnitte (#89 Quota-/Uploadvalidierung; #90 GET/HEAD-Auslieferungsheader). Kein Nachweis eines tatsächlichen Mergekonflikts aus Dateinamen allein; **kombinierte CI nach einem autorisierten Merge erforderlich**.
- #91 berührt keine Dateien der beiden Security-PRs; eigener CI-Check ist in `package.json` ergänzt. Für die Reihenfolge ist erst ein freigegebener Security-PR, dann CI auf `main`, anschließend der nächste PR sinnvoll; keinerlei automatischer Merge.
- Offene Freigaben: expliziter Mergeentscheid, manueller Browser-Test vor Deploy, echte Produktionsbackup-/Staging-Gates weiterhin GESPERRT.

## Präziser Hunk-Abgleich der gemeinsamen Testdatei
- PR #89 erweitert `scripts/test-account-creator-flow.mjs` bei Basiszeile 772 (Upload-Quota-/Streaming-/Größengrenztests, vor `const asset = ...`).
- PR #90 ergänzt dieselbe Datei erst bei Basiszeile 890 (GET/HEAD-HTTP-200-Header-Assertions innerhalb der Owner-Schleife).
- Die GitHub-Patches sind räumlich getrennt, ihre jeweiligen Kontexte überschneiden sich nicht; damit ist ein textueller Hunk-Konflikt **nicht zu erwarten**. Das ist keine simulierte Merge- oder kombinierte CI-Ausführung; nach autorisiertem Merge weiter prüfen.
- Letzte grüne CI #90: `43644681889` auf HEAD `305d179`. #89/#90/#91 weiterhin offen, clean, ohne Merge-Freigabe.

## Öffentliche OBS-Bildauslieferung: Header-Test ergänzt
- Vorheriger HEAD `1516661`: CI `43700236823` erfolgreich, PR clean.
- Der vorhandene PG18-End-to-End-Test prüfte veröffentlichte, anonym abrufbare OBS-Bilder bereits auf GET/HEAD, HTTP 200, `private, no-store` und Originalbytes. Er prüfte dort aber noch nicht `nosniff` und den validierten MIME-Typ.
- Commit `acc3f5e` ergänzt beide Headerprüfungen **für GET und HEAD** im bestehenden Published-Owner-Widget-Test. Autorisierungslogik, Veröffentlichungsregeln und Serverantwort bleiben unverändert. Kein öffentliches Testasset außerhalb der ephemeren CI.
- Abnahme: CI für neuen Testcommit und aktuellen Dokumentations-HEAD abwarten; PR weiterhin ungemergt.

## Veröffentlichungsentzug auch für HEAD abgesichert
- CI für vorherigen HEAD `9ae94ff`: Run `43701057296` **success**, inklusive öffentlich freigegebener GET/HEAD-OBS-Header-Prüfung.
- Neuer Testcommit `7ee294f`: Nach `published → private` wird das identische OBS-Bild anonym sowohl mit GET als auch HEAD auf HTTP `401` und `cache-control: no-store` geprüft. Die bestehende `json()`-Fehlerantwort setzt diesen Header bereits; kein Servercode und keine Berechtigungen geändert.
- Die Revocation-Regel bleibt DB-gestützt und wird in ephemerer PG18-CI getestet. Neue CI für diesen Commit/HEAD abwarten.

## Aktualisierung: Draft- und Fremdreferenz-HEAD-Zugriff
- Vorheriger Testcommit `7ee294f` (Widerruf öffentlicher GET/HEAD-Freigaben): GitHub Actions `43701127023` **success**. Dokumentations-HEAD `817e70d` beim Start dieser Runde noch in CI.
- Neuer Commit `3b04c82`: Bereits vorhandene 401-Tests für (a) veröffentlichte Fremdreferenz und (b) noch nicht veröffentlichten eigenen Entwurf laufen jetzt jeweils für **GET und HEAD**. Zusätzlich wird `cache-control: no-store` bei beiden Ablehnungen geprüft.
- Nur isolierter Testcode; kein Servercode, keine Rechteänderung, keine Produktion. Neue CI für diesen Commit/aktuellen HEAD abwarten.

## Abgewiesene private Medienzugriffe: Header-Regression
- Letzter vollständiger HEAD `0e85f2b`: GitHub Actions `43701234853` **success**; auch Testcommit `3b04c82` grün (`43701223900`).
- Die bestehende authentifizierte PG18-E2E-Matrix deckt Bild und Video, GET und HEAD sowie anonymous `401`, foreign creator `404`, owner `200` ab.
- Neuer Commit `5740633`: Für beide abgewiesenen Fälle werden nun zusätzlich `cache-control: no-store` und `x-content-type-options: nosniff` verlangt. Erfolgreiche Owner-Antworten bleiben wie bisher geprüft.
- Ausschließlich Teständerung; keine Berechtigungs-/Server-/Produktionsänderung. Aktuelle CI abwarten.

## Gelöschtes Video: GET/HEAD-Negativtest
- Letzter HEAD `469d941`: GitHub Actions `43701356829` **success**; vorheriger Testcommit `5740633` ebenfalls grün (`43701338143`).
- Neuer Testcommit `0341ac3`: Nach autorisierter Videolöschung und bestätigter physischer Dateientfernung wird die alte private URL mit Eigentümer-Cookie sowohl per GET als auch HEAD geprüft. Erwartet: `404`, `cache-control: no-store`, `x-content-type-options: nosniff`.
- Nur CI-Regression, keine Änderungen an Löschlogik, Berechtigungen oder Produktivsystem. Neue CI abwarten.

## Gelöschtes Video: Drei Rollen × zwei HTTP-Methoden
- Letzter dokumentierter HEAD `4acc33e`: CI `43701460576` **success**; gelöschtes Video GET/HEAD mit Owner-Cookie grün.
- Neuer Commit `304f841`: Nach physischer Löschung werden die alte Video-URL und die Header bei GET/HEAD für **anonym (401)**, **fremden Creator (404)** und **Eigentümer (404)** geprüft. Für alle sechs Antworten: `cache-control: no-store`, `x-content-type-options: nosniff`.
- Statuscodes spiegeln die bereits vorhandene Zugriffskontrolle wider; keine Änderung an Server- oder Datenbankcode. CI für den neuen Commit und den aktuellen Dokumentations-HEAD abwarten.

## Veröffentlichte Bildreferenz darf privates Video nicht freigeben
- Testcommit `304f841` (gelöschte Videos, 3 Rollen × GET/HEAD) in CI `43701694175` **success**. Dokumentations-HEAD `c318749` beim Start dieser Runde noch in CI.
- Neuer Commit `2990c74`: Während ein OBS-Widget das Eigentümer-Bild veröffentlicht, muss das separate private Video weiterhin bei anonymem GET und HEAD `401`, `cache-control: no-store` und `x-content-type-options: nosniff` liefern.
- Kein Servercode und keine Produktionsänderung; neue CI abwarten.

## Veröffentlichungsentzug: Eigentümerzugriff bleibt bestehen
- Letzter bestätigter grüner Dokumentations-HEAD `c318749`, CI `43701704791`. Die CI für den Video-Isolationstest `2990c74` und nachfolgenden HEAD `61d555c` war beim Start noch in Bearbeitung; Ergebnis nicht vorwegnehmen.
- Neuer Testcommit `9b0546f`: Nach `published → private` muss der Creator sein Bild weiter authentifiziert mit GET und HEAD (`200`) abrufen können, inklusive `private, no-store`, `nosniff`, `image/png` und unveränderten GET-Bytes. Anonymer Zugriff bleibt im unmittelbar vorherigen Test `401`.
- Kein Servercode/Produktionszugriff; neue CI prüfen.

## Fremde Löschung: Eigentümer-Video bleibt unverändert
- Vorheriger HEAD `dc5eee2` erfolgreich: CI `43701848825`; Codecommit `9b0546f` erfolgreich: `43701835699`.
- Neuer Commit `3bd311e`: Nach verweigerter Fremdlöschung (`404`) und Prüfung der weiter existierenden Datei wird der Videoabruf durch den Eigentümer mit GET und HEAD (`200`, `private, no-store`, `nosniff`, `video/mp4`) und unveränderten GET-Bytes geprüft. Erst danach erfolgt die legitime Eigentümer-Löschung.
- Reiner E2E-Test, keine Änderung an produktiver Löschlogik; neue CI abwarten.
