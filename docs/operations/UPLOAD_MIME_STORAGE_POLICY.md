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

### Bild-Signaturprüfung (Creator-Assets)

Zusätzlich zum MIME-abgeleiteten Speichernamen verweigert der
Asset-Endpunkt jetzt **vor dem Schreiben von Dateien oder
Datenbankmetadaten** Bilder, deren Header nicht zum angegebenen
`Content-Type` passt:

- PNG: offizielle 8-Byte-Signatur und erstes `IHDR`-Chunk.
- JPEG: `FF D8 FF`-SOI/Marker-Anfang.
- GIF: `GIF87a` oder `GIF89a`.
- WebP: `RIFF … WEBP` plus `VP8 `, `VP8L` oder `VP8X`.

Unpassende oder verkürzte Header (etwa HTML-Dateien, die sich als PNG,
JPEG, GIF oder WebP ausgeben) erhalten `415 INVALID_ASSET_SIGNATURE`.
Die Prüfung ist ein erster Filter und **keine** vollständige Datei-
dekodierung, Schadsoftwareprüfung oder Garantie, dass jede Bilddatei
fehlerfrei ist. Bereits gespeicherte Bestandsdateien werden dabei
nicht verändert. Auch Video-/Clip-Uploads besitzen jetzt einen begrenzten
Container-Header-Abgleich, **keine** vollständige Medienanalyse.
MP4 muss einen konsistenten `ftyp`-Boxanfang mit einer nicht-QuickTime-
Brand haben, QuickTime eine `ftyp`-Box mit `qt  `-Brand.
WebM und Matroska müssen einen kurzen, korrekt eingegrenzten
EBML-Header mit dem jeweiligen `DocType` (`webm` bzw. `matroska`)
besitzen. Der EBML-Parser liest maximal 4096 Headerbytes, nicht das
Video selbst. Ein fehlender, abgeschnittener oder unpassender
Video-Header führt vor Datei-/DB-Schreiboperationen zu
`415 INVALID_MEDIA_SIGNATURE`.

Das schränkt **bestimmte ältere QuickTime-Dateien ohne `ftyp`-Box**
bewusst ein; solche Dateien müssen künftig vor dem Upload in einen
unterstützten Container umverpackt werden. Auch eine bestandene
Signaturprüfung sagt **nichts** über korrekte Wiedergabe, Codec,
Laufzeit, Metadaten oder Schadsoftwarefreiheit aus.

Vorhandene Dateiinhalte und Datenbankzeilen werden nicht migriert.

## Sicherheitsnachweis

`node scripts/test-upload-media-policy.mjs` deckt erlaubte Typen,
kanonische Endungen und Legacy-Download-Fallbacks ab. Die bestehende,
**nur auf lokalem Wegwerf-PostgreSQL zulässige** Creator-HTTP-E2E
versucht absichtlich HTML-Bytes unter den vier unterstützten
Bild-MIME-Typen hochzuladen: Diese werden jetzt jeweils mit **415**
abgelehnt. Ein tatsächliches minimales PNG wird akzeptiert; die
separaten Video-Tests weisen nun nach, dass HTML unter **allen vier**
Video-MIME-Typen mit `415` abgelehnt wird und synthetische passende
Container-Header mit dem irreführenden Originalnamen
`masquerading.html` ausschließlich private MIME-konforme
`.mp4`-, `.mov`-, `.webm`- und `.mkv`-URLs ergeben.
GET/HEAD behalten `nosniff` und `no-store`. Zusätzlich wird
eine synthetische alte `.html`-Assetzeile erzeugt und nach dem
HTTP-Test vollständig aus Test-DB und Test-Dateisystem entfernt; der
Eigentümer erhält die Bytes nur als Attachment und anonyme Abrufe
bleiben gesperrt.

Kein Production-Backup, keine Live-Migration und kein Render-Deploy.
