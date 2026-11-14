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

## Einheitliche Obergrenze für gepufferte Binär-Uploads

Der aktuelle Node-HTTP-Server liest Bild- und Video-/Clip-Uploads
vollständig in den Arbeitsspeicher. Bisher prüfte der frühe
`Content-Length`-Pfad auf maximal **16 MiB**, aber der
Chunked-Reader ohne `Content-Length` erst bei **256 MiB**.
Diese Diskrepanz erlaubte unnötig große Speicherbelegungen.

Alle vom Server vollständig gepufferten Binär-Uploads verwenden jetzt
ein und dieselbe Obergrenze `maxBufferedUploadBytes = 16 * 1024 * 1024`
Bytes – sowohl bei angegebener Länge als auch bei
`Transfer-Encoding: chunked`. Ein zusätzlicher Chunk, der die Grenze
überschreitet, führt zu `413 PAYLOAD_TOO_LARGE`, **bevor** alle
Chunks zu einer großen Datei zusammengeführt oder auf Disk/DB
gespeichert werden.

Die bisherige `user_media`-API meldete einen Wert von **512 MiB**,
obwohl ein normaler HTTP-Upload mit `Content-Length` schon bei
16 MiB abgewiesen wurde. Die für Video-/Clips sichtbare
`limits.max_file_bytes`-Angabe ist jetzt auf die tatsächlich
verfügbare **16-MiB-Grenze** korrigiert. Bestehende Videos und ihre
Downloadberechtigungen werden nicht verändert. Größere echte
Videodateien benötigen einen separat entworfenen Streaming-/Storage-
Upload mit begrenztem Speicherverbrauch und eigener Abnahme.
Das ist eine bewusste **Benutzerfunktions-Einschränkung** gegenüber
bisherigen chunked Uploads über 16 MiB, keine verdeckte
512-MiB-Freigabe.

Der Test `scripts/test-request-raw.mjs` prüft volle und
überschrittene Grenzen einschließlich echter chunked HTTP-Anfragen
ohne `Content-Length`. Die isolierte PostgreSQL-18-HTTP-E2E
prüft die korrigierte öffentliche Creator-Video-Limitangabe.

## Keine verwaisten Dateien bei fehlgeschlagenem Datenbankeintrag

Ein hochgeladenes Bild oder Video ist erst vollständig registriert,
wenn zu den gespeicherten Bytes auch ein gültiger Datenbankeintrag
existiert. Zuvor konnten `creator_assets`- und `user_media`-Uploads
nach dem Dateischreiben an einer fehlgeschlagenen
`INSERT`-Operation scheitern und unreferenzierte Dateien hinterlassen.

Beide API-Endpunkte verwenden nun einen gemeinsamen
`storeUploadWithRecord`-Helfer: Die Datei wird ausschließlich
mit `wx` angelegt (bestehende Dateien werden nie überschrieben)
und mit restriktiven Dateirechten gespeichert. **Nur wenn die
Datei wirklich neu angelegt wurde**, wird beim Fehlschlag des
anschließenden Datenbankeintrags die Datei wieder gelöscht.
Der ursprüngliche Fehler wird dabei nicht verdeckt. Bei einem
Fehler während dieser Bereinigung wird eine neutrale Meldung
`upload_orphan_cleanup_failed` ohne Datei- oder Kontonamen
geschrieben.

Die Kompensation ist **best effort**: Dateisystem und PostgreSQL
lassen sich nicht als eine einzige atomare Transaktion behandeln.
Beispielsweise können ein Prozessabsturz zwischen Dateischreiben
und Datenbankeintrag oder ein nicht eindeutiger Commit-Status
weiterhin eine manuelle Prüfung erforderlich machen. Es findet
bewusst **kein pauschales Löschen alter Uploads** statt.

Ein reiner Test im temporären Verzeichnis kontrolliert erfolgreiche
Speicherung, Abbruch und Datei-Cleanup sowie `EEXIST`-Kollisionen.
Die PostgreSQL-18-HTTP-E2E erzwingt zusätzlich auf der **nur lokal
zugelassenen CI-Datenbank** für je einen Bild- und Video-Sentinel
einen SQL-`CHECK`-Fehler. Nach dem 500-Fehler darf im
Uploadverzeichnis keine neue Datei verbleiben. Die beiden
synthetischen Test-Constraints werden sofort wieder entfernt.

## Physische Datei-Bereinigung beim Löschen von Videos und Clips

Bisher entfernte `DELETE /api/creator/media/(videos|clips)/:id` nur den
owner-scoped `user_media`-Datensatz. Die Bytes der Datei blieben
auf Disk, obwohl der Server den Zugriff bereits verweigerte. Dadurch
konnten sich nicht mehr referenzierte Medien über längere Zeit ansammeln.

Nach erfolgreichem, eigentümergebundenem Datenbank-DELETE versucht
der Handler jetzt auch den **physikalischen Upload** zu entfernen.
Dazu gelten strikte Schutzmaßnahmen:

- Gelöscht werden nur Dateien mit einem durch den Code erzeugbaren
  Namen `<Account-UUID>-<Datei-UUID>.<mp4|webm|mov|mkv>` oder
  dem älteren Format
  `<Account-UUID>-<Datei-UUID>-<bereinigter Originalname>`.
  Die eingebettete Account-UUID muss zum authentifizierten Besitzer
  passen; fremde, manipulierte und verzeichnishaltige Pfade werden
  nie an `unlink` übergeben.
- **Vor dem physikalischen Entfernen** liest der Server ab, ob
  ein anderer `user_media`- oder `creator_assets`-Datensatz
  noch genau diesen `storage_path` referenziert. In diesem
  Fall bleibt die Datei erhalten – auch dann, wenn die andere
  Referenz einem weiteren Konto gehört.
- Bereits fehlende Dateien gelten als bereinigt. Scheitert die
  Referenzabfrage oder das Entfernen der Datei, bleibt der
  **erfolgreiche Metadaten-DELETE wirksam**; der Fehler wird ohne
  Datei-/Kontonamen als `media_delete_storage_cleanup_failed`
  protokolliert.

Das ist **Best-Effort-Bereinigung**, keine garantierte atomare
Transaktion über PostgreSQL und Dateisystem. Ein Stromausfall nach
dem Datenbank-DELETE oder ein I/O-Fehler kann weiterhin einen
verwaisten Upload hinterlassen. Es erfolgt ausdrücklich **kein
pauschaler Scan und kein Bereinigen vorhandener Bestandsdateien**.

Reine Tests prüfen die erzeugten Storage-Namensformen, Fremd-
Account-Pfade, Traversal, überlebende Referenzen, fehlende Dateien
und das gezielte Löschen im temporären Verzeichnis. Die
isolierte PostgreSQL-18-HTTP-E2E prüft außerdem, dass ein
fremder DELETE mit 404 abgewiesen wird, der eigene DELETE
seine Datei tatsächlich entfernt und eine zweite Asset-Referenz
das Entfernen zuverlässig verhindert.

## Optionale Video-Laufzeit als begrenztes Metadatum

Der Header `X-CFS-Duration-Ms` war bisher direkt mit `Number()`
umgewandelt worden. Negativwerte, Fließkommazahlen, `Infinity`
oder Werte außerhalb der PostgreSQL-`integer`-Spalte
`user_media.duration_ms` konnten dadurch unpassende Metadaten
oder einen Datenbankfehler auslösen.

Jetzt gelten vor jedem Dateischreiben **klare Eingaberegeln**:
Ein fehlender oder leerer Header bleibt `NULL`, `0` bleibt zur
bisherigen API kompatibel ebenfalls `NULL`. Ansonsten wird nur eine
nichtnegative ganze Dezimalzahl zwischen `1` und `2147483647`
Millisekunden akzeptiert. Unpassende, negative, nachträglich gerundete,
nicht endliche oder zu große Werte werden für Videos **und** Clips
mit `400 INVALID_MEDIA_DURATION` abgewiesen. Der Header beschreibt
nur vom Client deklarierte Metadaten; dies ist kein Beweis für die
wirkliche Video- oder Audiodauer.

Die CI testet die Umwandlung direkt und bei realen Creator-HTTP-
Uploads auf der **isolierten lokalen PostgreSQL-18-Datenbank**:
eine gültige Dauer wird als Ganzzahl gespeichert, ungültige Header
schlagen kontrolliert fehl, ohne neue Medienzeilen anzulegen.

Kein Production-Backup, keine Live-Migration und kein Render-Deploy.
