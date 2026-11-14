# Übergabe – Upload-Auslieferung ohne MIME-Sniffing

Stand: 14.11.2026. Branch `security/upload-delivery-nosniff-2026-11-14` (von `main`).

## Änderung
`src/upload-media-policy.js`: `uploadDeliveryHeaders()` liefert `X-Content-Type-Options: nosniff` für bekannte Bild-/Videotypen und unbekannte Legacy-Dateiendungen. Letztere bleiben als `application/octet-stream` mit `Content-Disposition: attachment` ausgeliefert. Die Funktion dient der sicheren Auslieferung gespeicherter Uploads und ersetzt keine Dateidekodierung oder Virenprüfung.

`scripts/test-upload-media-policy.mjs`: Regressionstests für den Header bei bekannten und unbekannten Endungen. Bestehende MIME- und Attachment-Erwartungen bleiben erhalten.

## Risiko / Abnahme
Browser dürfen Uploads nicht mehr als abweichende Typen interpretieren. Dies kann bisher nur durch Browser-Sniffing funktionierende fehlerhaft gespeicherte Dateien beeinflussen; das ist sicherheitsseitig erwünscht. Vor Freigabe CI auf dem endgültigen HEAD prüfen, danach Browser-/OBS-Tests bei Gelegenheit. Keine DB-Migration, kein Deployment, keine Secret-Änderung. Rollback: PR nicht mergen bzw. Commit revertieren.

## Status
Code und Tests committet; CI-Nachweis für diesen neuen Branch bei Erstellung noch ausstehend. PR #89 bleibt separat als Draft, seine CI war für HEAD `c761adb` erfolgreich.
