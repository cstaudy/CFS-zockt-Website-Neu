# Upload-Download-Sicherheit: MIME und gespeicherte Dateiendungen

**Motivation:** Der Name einer hochgeladenen Datei ist untrusted input. Vor
dieser Änderung speicherten das Creator-Asset-API und das Video-/Clip-API
hochgeladene Dateien mit der vom Client übermittelten Endung. Der statische
HTTP-Handler leitete den auszuliefernden `Content-Type` ebenfalls aus
dieser Endung ab. Eine als Bild deklarierte Datei mit dem Ursprungsnamen
`beispiel.html` konnte dadurch später als **HTML derselben Website**
ausgeliefert werden. `nosniff` allein genügt nicht als Schutz, wenn der
Server selbst `text/html` setzt.

## Neue Uploads

- Die erlaubten MIME-Typen bleiben unverändert: PNG, JPEG, WebP, GIF,
  MP4, WebM, QuickTime und Matroska, jeweils nur im passenden bestehenden
  Asset- bzw. Video-Endpunkt.
- **Gespeicherte Dateiendungen stammen ausschließlich aus dem geprüften
  Upload-MIME-Typ**, nicht mehr aus `X-CFS-File-Name`: beispielsweise
  `image/png` → `.png`, `video/mp4` → `.mp4`.
- Der bereinigte ursprüngliche Dateiname bleibt in der Datenbank als
  **Anzeige-Metadatum** erhalten. Der API-Ausgabe-Link verweist auf den
  kanonischen, UUID-basierten Speicherpfad.
- Die vorhandenen Eigentümer-, Veröffentlichungs- und Cookieprüfungen für
  `/assets/uploads/` gelten unverändert.

## Bereits vorhandene Uploads

Die URL bereits gespeicherter Uploads wird **nicht** umgeschrieben.
Damit eine historische `.html`-, `.svg`-, `.js`-, `.xml`- oder
ähnliche Benutzerdatei nicht als ausführbares Dokument unter der
Website-Origin gerendert werden kann, liefert der statische Handler
diese und unbekannte Endungen nach bestandener Berechtigungsprüfung mit

`Content-Type: application/octet-stream`
und `Content-Disposition: attachment; filename="download"`

aus. Die sichere Allowlist zum direkten Ausliefern umfasst PNG, JPEG,
WebP, GIF, MP4, WebM, QuickTime und Matroska. Historische `.jpeg`
bleiben als JPEG lesbar. Das vorhandene `X-Content-Type-Options:
nosniff` und `Cache-Control: private, no-store` bleiben erhalten.
Alte Formate außerhalb dieser Allowlist können von ihrem berechtigten
Besitzer weiter heruntergeladen, aber nicht mehr direkt im Browser
ausgeführt oder eingebettet werden.

**Abgrenzung:** Der Fix validiert die deklarierten MIME-Typen und ihre
Auslieferung, **nicht** die tatsächlichen Dateisignaturen oder
vollständige Bild-/Videodekodierung. Für einen späteren Import-/Transcode-
Workflow sind separate, isoliert getestete Dateiinhaltprüfungen nötig.
Vorhandene Dateiinhalte und Datenbankzeilen werden nicht migriert.

## Sicherheitsnachweis

`node scripts/test-upload-media-policy.mjs` deckt erlaubte Typen,
kanonische Endungen und Legacy-Download-Fallbacks ab. Die bestehende,
**nur auf lokalem Wegwerf-PostgreSQL zulässige** Creator-HTTP-E2E
lädt absichtlich HTML-Bytes unter einem `image/png`- bzw.
`video/mp4`-Header mit dem angegebenen Dateinamen
`masquerading.html` hoch: Die zurückgegebenen Speicher-URLs enden
auf `.png` bzw. `.mp4` und die Antworten bleiben `image/png` bzw.
`video/mp4` mit `nosniff` und privatem `no-store`. Zusätzlich wird
eine synthetische alte `.html`-Assetzeile erzeugt und nach dem
HTTP-Test vollständig aus Test-DB und Test-Dateisystem entfernt; der
Eigentümer erhält die Bytes nur als Attachment und anonyme Abrufe
bleiben gesperrt.

Kein Production-Backup, keine Live-Migration und kein Render-Deploy.
