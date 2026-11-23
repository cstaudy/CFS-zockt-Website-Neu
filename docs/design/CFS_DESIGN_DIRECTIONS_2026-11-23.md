# CFS-Zockt – Designrichtungen zur Auswahl

Die sechs Referenzbilder wurden als verbindliche Vorlagen geprüft. Gemeinsame Leitplanken: dunkles Navy, cyanfarbene Akzente, weißes CFS-Logo, Berg-/Wasser-Keyvisual, klare horizontale Linien, abgerundete Karten mit dünner Kontur, reduzierte Glow-Effekte, große gut lesbare Typografie und eine konsistente Desktop-/iPhone-Hierarchie.

## Richtung A – Arctic Signal (Empfehlung)

**Charakter:** ruhige, hochwertige Gaming-Marke mit kaltem Lichtsignal.  
**Farben:** `#061522` Hintergrund, `#0B2438` Surface, `#11D7F2` Primärakzent, `#168BDB` Sekundärakzent, `#F3F7FA` Text, `#9EB2C2` Metatext.  
**Typografie:** `Space Grotesk`-ähnliche geometrische Überschriften plus gut lesbare systemnahe Sans für Text; lokale/systemnahe Fallbacks zuerst.  
**Komponenten:** Cyan-Topline, klare Primär-/Sekundärbuttons, Karten mit 1px-Kontur, Icons als ruhige Linien, Diagramme ohne Neon-Flächen.  
**Interaktion:** 160–220 ms Übergänge, sichtbarer Fokus, kein dauerhaftes Pulsieren.  
**Passung:** höchste Übereinstimmung mit Startseite, Login, Dashboard und Admin-Referenz; gut für iPhone.

## Richtung B – Creator Grid

**Charakter:** stärker werkzeugorientiert, modular und produktiv.  
**Farben:** gleiches Navy/Cyan-Grundsystem, zusätzlich gedämpftes Violett für Studio-Modi und warmes Amber nur für Warnungen.  
**Typografie:** kompakte Display-Schrift für Seitentitel, neutrale Sans für Tabellen und Formulare.  
**Komponenten:** dichteres 8px-Raster, linke Studio-Navigation, Toolbar, Status-Chips und modulare Arbeitsflächen.  
**Interaktion:** Drag-/Resize-Zustände, klare Undo-/Save-Rückmeldungen, reduzierte dekorative Flächen.  
**Passung:** ideal für Creator Suite, Stream Studio und Widget Studio; für die öffentliche Startseite weniger emotional.

## Richtung C – Summit Editorial

**Charakter:** redaktionelle Gaming-/Community-Marke mit großen Bildflächen und ruhigem Magazinrhythmus.  
**Farben:** Navy und Weiß dominieren; Cyan nur für Links und Aktionen, keine zusätzlichen Akzentfarben.  
**Typografie:** markante Condensed-Überschriften, sehr großzügiger Fließtext und große Zahlen.  
**Komponenten:** große Hero-Story, Content-Karten, Kapiteltrenner, ruhige Footer-Navigation.  
**Interaktion:** sanfte Bild-/Opacity-Transitions, keine komplexen Effekte.  
**Passung:** stark für Home, Streams und Clips; für Admin-/Studio-Flächen müsste es mit Richtung B kombiniert werden.

## Empfehlung und Auswahlpunkt

Ich empfehle **Richtung A – Arctic Signal** als Markenbasis und eine sparsame Übernahme der Arbeitsflächen-Dichte aus Richtung B für die Creator-Studios. Das respektiert die Referenzbilder, bleibt eigenständig und vermeidet ein generisches Neon-Template.

Die websiteweite Umsetzung beginnt erst nach Auswahl. Danach werden Tokens, Font-Stack, Spacing, Buttons, Karten, Navigation, Formzustände, Focus-Ringe, Mobile Breakpoints und Motion-Regeln in einem separaten Design-PR dokumentiert und getestet. Es werden keine externen Fonts oder Bildquellen ohne Lizenz-/Performance-Prüfung eingebunden.

