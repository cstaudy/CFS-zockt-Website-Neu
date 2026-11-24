# CFS Website & Community – Entwicklungsplan
Stand: 2026-11-24. Arbeitszweig: development/website-community. Ergänzt die bestehenden projektweiten Pläne; ersetzt keine Infrastrukturplanung.

## Ziel
Gaming, TikTok und Discord als öffentliche Einstiegsseite; Creator Suite als eigener Produktbereich unter derselben Marke. Original-Logo und Standarddesign erhalten.

## Reihenfolge und Abnahme
1. Startseite: persönliche Texte und Navigation begonnen (c6fff36); doppelte Spielebereiche, mobile Navigation, Links und Reihenfolge prüfen. Keine dynamischen IDs entfernen, bevor deren Verbraucher geprüft sind.
2. CMS: bestehende öffentliche Inhaltsfelder für Willkommen und Über mich angebunden (acf7310). Bestehende Admin-API, Schema, Rollen/MFA und Entwurf/Publikation lokalisieren und testen. Kein zweites CMS. Entwurf nur für autorisierte Admins; öffentliche API ausschließlich publizierte Version. Vorschau, Revisionen, Wiederherstellung und iPhone-Bedienung prüfen/ergänzen. Bestehende publizierte Inhalte können HTML-Fallback überschreiben.
3. Branding: CSS-Hooks für Hero-Hintergrund und Abdunklung vorbereitet (cfc90ca). Noch kein Editor, Upload oder persistentes Design. Zunächst private lokale Vorschau; später validierte Medienreferenzen, erlaubte Bildtypen, Größenlimits, Eigentümerprüfung, begrenzte Deckkraft, Standard-Reset. Keine beliebigen CSS- oder URL-Eingaben. Desktop/Mobil, Kontrast und Original-Logo prüfen. Entwurf/Publikation über vorhandenes CMS, sofern geeignet.
4. Community: Discord und TikTok, Gameserver als geplant kennzeichnen; keine erfundenen Live-Daten oder Zusagen.
5. Creator Suite: Widget/Scene/Stream Maker, verständliche Navigation, Beta-Gates erhalten; Shop nur bestehende erlaubte Vorschauen. Launcher/OBS/Provider-Praxistests separat.
6. Abnahme: vorhandene npm-check-Suite, HTML/Links, responsive Browser, öffentliche vs. Admin-Rechte, Entwurfsisolation, Medienvalidierung, Rücksetzung. Ergebnisse mit Commit und Umgebung dokumentieren. Kein Merge/Deployment ohne ausdrückliche Freigabe.

## Grenzen
Render/Neon, Migrationen, Backup, produktive Daten, Secrets und Authentifizierung nicht verändern. Persistenzänderungen erst nach Abstimmung mit Codex und isolierter Testdatenbank. Keine Tests als bestanden markieren, wenn nicht ausgeführt.

## Fortschritt 2026-11-24 – c9b1eeb
Bestehendes CMS in pages/admin-creators.html und assets/js/admin-control-center-v181.js gefunden: Admin-GET /api/admin/site-content, PUT draft, POST publish/revert; Textvorschau und Revisionsstatus vorhanden. Backend-Autorisierung und Isolation noch nicht getestet. Lokale Designvorschau nach erfolgreichem Laden der Admin-Inhalte ergänzt: PNG/JPEG/WebP bis 8 MiB, Bildabmessungen geprüft, Blob-URL, Abdunklung, Standard-Reset. Kein Upload, keine Persistenz, keine Veröffentlichung. Browserprüfung inklusive CSP für blob:-Bilder, iPhone, Fehlerfälle und Admin-Sperre offen. Nächster Schritt: bestehende CMS-Backend-Routen und Tests lokalisieren, Vorschau praktisch prüfen, sichere Persistenz erst abgestimmt ergänzen. Keine Migration oder Produktion geändert.

## Korrektur nach Backend-Prüfung – f27e677
server.js im Arbeitsbranch enthält keine /api/admin/site-content CRUD-Routen und keine /api/public/site-content Route. Der Staging-Neon-Branch enthält lediglich eine öffentliche Fallback-Route, keinen editierbaren Store. Admin-Elevation ist im Arbeitsbranch ausdrücklich unavailable. Vorherige Aussagen zu CMS-Speicherung beziehen sich ausschließlich auf Frontend-Code. CMS-Aktionsbuttons werden nun bis zum erfolgreichen Laden gültiger Abschnitte deaktiviert; bei Fehlern klare Meldung. Lokale Designvorschau bleibt bis zu erfolgreichem CMS-GET verborgen. Keine Browser- oder Integrationstests ausgeführt. Nächster Schritt: Backend-Vertrag und isolierte Persistenz mit Codex abstimmen, bestehende Migrationen prüfen; keine Produktionsänderungen. Alternativ lokale Vorschau nach separat verifiziertem Admin-Zugriff freischalten, ohne CMS-Speicherung vorzutäuschen.

## Lokale Vorschau unabhängig vom CMS – df825db
Vorschau wird nach erfolgreichem GET /api/admin/control-center/summary eingeblendet, nicht mehr nach CMS-GET. server.js schützt Summary über requireAdmin; src/projects.js prüft Session und Admin-E-Mail, keine zusätzliche MFA-Elevation in dieser Route. Kein Upload oder Schreibzugriff. Bildlimit zusätzlich 24 Megapixel. JS-Syntax mit new Function geprüft, keine Browser-/API-Tests ausgeführt. CMS-Speicherbuttons bleiben bei fehlender API gesperrt. Nächste Abnahme: Admin/401/403, CSP, mobile Darstellung und lokale Bildvorschau. Persistenz weiterhin separat abstimmen.
