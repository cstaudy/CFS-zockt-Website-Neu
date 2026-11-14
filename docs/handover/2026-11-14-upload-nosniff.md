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
