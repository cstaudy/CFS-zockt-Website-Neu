# Cut Studio → Multi-Publisher: Medienübergabe

Stand 28.11.2026, PUB-02/03; Folge-PR zu #115, nutzt die Vorschau aus #111.

## Bestand und Entscheidung
- Website 3: Cut Studio nutzt die bestehende Mediathek (Videos/Clips), getrennte lokale Launcher-Exportjobs und accountgebundene Medien-API. Lokale Exportergebnisse sind nicht automatisch Mediathek-Dateien. Mobile Gaming Edition #106 bleibt separat; kein zweiter Editor/Renderer.
- Minimaler Übergabeschritt: bestehende Medienkarte erhält einen Link „PUBLISHER-VORSCHAU“. Nur bei gültiger Medien-UUID, feste interne Zielseite, UUID im URL-Fragment statt Query oder Dateipfad. Bestehende Button-Klasse, keine CSS-/Layout-/Branding-Änderung.
- Die authentifizierte Integrationsseite lädt wie bisher Videos/Clips. Nur eine ID aus dieser eigenen Liste darf vorausgewählt werden. Fehlende, fremde oder ungültige ID ergibt keine Auswahl. Bei erfolgreicher Medienabfrage wird der Fragment-Identifier durch den Formularanker ersetzt. Keine automatische Preview-Anfrage, Entwurfsanlage, Freigabe oder Veröffentlichung.
- Serverprüfung im bestehenden Publisher-Preview-Endpunkt bleibt verbindlich; UUID ist keine Zugriffsberechtigung. Keine neue API oder Datenbankmigration.
- Ein fertiger lokaler Export muss bewusst über die vorhandene Mediathek importiert werden; deren bisheriges 16-MiB-Uploadlimit und Speicher-/Privacy-Abnahme bleiben unverändert. Die Übergabe beweist nicht, dass ein gewähltes Video gerendert oder unverändert ist.

## Test und Abnahme
- Ausführbarer JavaScript-Mock-DOM-Test nutzt die tatsächlichen Funktionskörper: korrekter Link, ungültige IDs, autorisierte Vorauswahl, fremde/fehlende ID, Offline-Zustand, gewöhnlicher Einstieg, keine automatische POST-Anfrage. Eingebunden im vorhandenen Provider-Testlauf.
- CI sowie echte Desktop-/Mobil-Browserprüfung offen. Referenzbilder sind im Repository vorhanden, konnten aus dieser Arbeitsumgebung nicht visuell geöffnet werden; keine Designfreigabe und keine neuen Screenshots beansprucht. Nur vorhandene UI-Klasse verwendet.
- #50 berührt beide JS-Dateien; selektiver Abgleich nötig. #106 ändert die Cut-HTML, die hier unverändert bleibt. #110/#111/#113/#115 zuerst integrieren, Provider-Testimports aus #112/#114 erhalten.
- Nächster Schritt: tatsächliche sichere Exportdatei-Übergabe, private/immutable Render-Varianten mit Inhaltsfingerabdruck und Größen-/Codecprüfung; keine ungeprüften Launcher-Pfade oder öffentliche Medien-URLs übernehmen. Separate Render-/Provider-/DB-Abnahme.
- Rollback: Folge-PR nicht mergen oder vier Code-/Testdateien und dieses Dokument gemeinsam revertieren. Kein Merge, Deploy, produktives SQL, externer Upload oder neue Kosten.
