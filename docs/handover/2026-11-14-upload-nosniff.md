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
