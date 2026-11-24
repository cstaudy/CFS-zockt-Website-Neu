# Übergabe an Codex / VS Code
Stand 2026-11-24. Repository cstaudy/CFS-zockt-Website-Neu.
Arbeitszweig development/website-community; nicht automatisch mit main zusammenführen.

## Bisherige Änderungen
- c6fff36: index.html – persönliche Vorstellung, TikTok-Fokus, Navigation, Creator-Einstieg.
- acf7310: index.html – data-site Bindings für identity.hero_kicker, why_kicker, why_title, why_text_1 und why_text_2.
- cfc90ca: assets/css/cfs-reference-system.css – CSS-Variablen für Hero-Hintergrund und Abdunklung, Standardwerte erhalten; About-Textlayout.
- Begleitplan: docs/website-community-development-plan.md.

## Offene Punkte
Vorhandener Loader assets/js/cfs-public-content-v181.js liest /api/public/site-content. Admin-Status erwähnt publizierte Inhalte und Entwürfe; tatsächliche Admin-Speicher-/Publikationsrouten und Datenmodell noch nicht verifiziert. Bestehende veröffentlichte Inhalte können neue HTML-Fallbacks überschreiben. Keine vollständigen Tests ausgeführt. Design-Hooks sind noch nicht an Einstellungen angeschlossen.

## Nächste Schritte
1. Lokale uncommittete Änderungen sichern und Branch-Diff zu aktuellem main prüfen.
2. Vorhandene CMS-Implementierung lokalisieren, Autorisierung und Entwurfsisolation prüfen.
3. Private Designvorschau ohne Datenbankänderung implementieren; erst danach sichere Persistenz abstimmen.
4. npm run check und responsive Browser-/Admin-Tests in isolierter Umgebung; Befunde dokumentieren.
5. PR erst nach Review; keine automatische Produktion.

## Parallel laufende Infrastruktur
chore/neon-mobile-migration-20261122, fix/staging-site-content-neon-20261122, codex/iphone-pg18-backup-restore-draft. Migrationserfolg nicht verifiziert. Keine dieser Branches, Render/Neon oder produktiven Daten durch Website-Arbeiten verändern. Staging-Korrekturen berühren server.js, Admin und Passwortwiederherstellung; Konflikte vor Integration prüfen.

## Fortschritt 2026-11-24 – c9b1eeb
Bestehendes CMS in pages/admin-creators.html und assets/js/admin-control-center-v181.js gefunden: Admin-GET /api/admin/site-content, PUT draft, POST publish/revert; Textvorschau und Revisionsstatus vorhanden. Backend-Autorisierung und Isolation noch nicht getestet. Lokale Designvorschau nach erfolgreichem Laden der Admin-Inhalte ergänzt: PNG/JPEG/WebP bis 8 MiB, Bildabmessungen geprüft, Blob-URL, Abdunklung, Standard-Reset. Kein Upload, keine Persistenz, keine Veröffentlichung. Browserprüfung inklusive CSP für blob:-Bilder, iPhone, Fehlerfälle und Admin-Sperre offen. Nächster Schritt: bestehende CMS-Backend-Routen und Tests lokalisieren, Vorschau praktisch prüfen, sichere Persistenz erst abgestimmt ergänzen. Keine Migration oder Produktion geändert.

## Korrektur nach Backend-Prüfung – f27e677
server.js im Arbeitsbranch enthält keine /api/admin/site-content CRUD-Routen und keine /api/public/site-content Route. Der Staging-Neon-Branch enthält lediglich eine öffentliche Fallback-Route, keinen editierbaren Store. Admin-Elevation ist im Arbeitsbranch ausdrücklich unavailable. Vorherige Aussagen zu CMS-Speicherung beziehen sich ausschließlich auf Frontend-Code. CMS-Aktionsbuttons werden nun bis zum erfolgreichen Laden gültiger Abschnitte deaktiviert; bei Fehlern klare Meldung. Lokale Designvorschau bleibt bis zu erfolgreichem CMS-GET verborgen. Keine Browser- oder Integrationstests ausgeführt. Nächster Schritt: Backend-Vertrag und isolierte Persistenz mit Codex abstimmen, bestehende Migrationen prüfen; keine Produktionsänderungen. Alternativ lokale Vorschau nach separat verifiziertem Admin-Zugriff freischalten, ohne CMS-Speicherung vorzutäuschen.

## Lokale Vorschau unabhängig vom CMS – df825db
Vorschau wird nach erfolgreichem GET /api/admin/control-center/summary eingeblendet, nicht mehr nach CMS-GET. server.js schützt Summary über requireAdmin; src/projects.js prüft Session und Admin-E-Mail, keine zusätzliche MFA-Elevation in dieser Route. Kein Upload oder Schreibzugriff. Bildlimit zusätzlich 24 Megapixel. JS-Syntax mit new Function geprüft, keine Browser-/API-Tests ausgeführt. CMS-Speicherbuttons bleiben bei fehlender API gesperrt. Nächste Abnahme: Admin/401/403, CSP, mobile Darstellung und lokale Bildvorschau. Persistenz weiterhin separat abstimmen.

## Öffentliche Website – 54c4ec8 / 8b9d40b
Community vor Clips, Creator-Designs und Creator-Pfad nach Gaming-Bereich verschoben; PlayStation-Aktivität klarer benannt, Design-Link verweist auf vorhandenen Shop statt versteckten Abschnitt. Alle bisherigen IDs erhalten, eindeutige IDs und interne Anker beim ersten Commit geprüft; zweiter Commit ergänzt geplanten Enshrouded-Community-Server mit Discord-Interessenslink, ohne Starttermin oder Kapazitätsversprechen. Keine bestehenden Spiel-Datenquellen entfernt. Browser/CSS-Reihenfolge, Shop-Anker, Discord-Einladung und vollständige npm-Checks offen. CMS und Infrastruktur unverändert. Nächster Schritt: mobile Layout-Abnahme und Creator-Einstieg konsolidieren.

## Mobile Darstellung und Creator-Einstieg – 10e30ee / d169031
Öffentliche mobile CSS-Regeln für 44px Menüziele, scrollbares Menü, umbrechende Abschnittsköpfe, lesbarere Community-Texte, Gameserver-Link und einspaltige Feature-Karten bis 420px ergänzt. Creator-Pfad auf kleinen Displays angepasst. Creator-Suite-Einleitung benennt Entwicklungsstatus und Voraussetzungen ohne Freigabeversprechen. Original-Logo und Tool-Routen unverändert. Browserprüfung bei 320/375/390/430/768px und Desktop, Menü-Tastaturbedienung, CSS-Kaskade und npm run check weiterhin offen. Nächster Schritt: reproduzierbare Tests und Abnahme statt weiterer ungeprüfter Layoutänderungen.

## Regressionstests – 03ccb4e / 1b03e37
scripts/test-website-community.mjs ergänzt und an npm run check angehängt. Direkt am Branch-Quelltext geprüft: keine doppelten IDs oder fehlenden lokalen Anker in index.html und Creator Suite, Community/Gaming vor Designbereich, JS-Syntax gültig. Mock-Ausführung des Admin-Scripts bei 401/403/404 erfolgreich: CMS-Aktionen deaktiviert und Fehlermeldung sichtbar. Keine echte API oder Browser geprüft; Node-Testdatei und vollständiges npm run check noch lokal/CI ausführen. Nächster Schritt: erfolgreiche Admin-Summary mit lokaler Vorschau, Bildfehler und CSP im Browser testen; danach PR-Review ohne automatischen Merge.

## Design-Vorschau: Zugriffsverlust und Bildtests – fa3c5e9 / 1bfa207
Admin-Summary muss ok:true liefern. Bei fehlgeschlagener erneuter Summary-Abfrage wird die lokale Vorschau entfernt, Blob-URL freigegeben und pagehide-Listener entfernt. Regressionstest erweitert: erfolgreicher Admin-Zugriff trotz fehlendem CMS, SVG und >8 MiB abgelehnt, >24 MP abgelehnt, Dekodierfehler, gültiges Bild, Reset, Zugriffsentzug beim Refresh, keine Upload-Anfragen. Mock-Harness am aktuellen Quelltext in JS-Isolate erfolgreich ausgeführt (Microtask-Flush statt Node setImmediate). Vollständige Node-Suite, echter Browser, CSP und Server-Autorisierung weiterhin offen. Keine Persistenz oder Infrastrukturänderung. Nächster Schritt: responsive Vorschau und Backend-Vertragsentwurf ohne Migration, anschließend Review.

## Responsive Design-Vorschau – 061d38a / aed1877
Desktop-Format (verfügbare Breite) und Smartphone-Format (max. 390px, Mindesthöhe 360px) sowie fünf erlaubte Hintergrundpositionen ergänzt. Reset stellt Desktop, Mitte, Standardbild und 65% Vorschau-Abdunklung wieder her. Erweiterter Mock-Harness erfolgreich im JS-Isolate ausgeführt. Keine vollständige Website-Simulation, keine Speicherung; Browser/CSP und npm run check offen.
### Geplanter Backend-Vertrag (Entwurf, nicht implementiert)
Bestehende CMS-Routen wiederverwenden, nach Abstimmung einen Abschnitt home.design mit validierter Medien-ID statt freier URL, begrenzter Abdunklung und erlaubter Position ergänzen. Entwurf und veröffentlichte Revision getrennt; Schreibzugriff nur serverseitig autorisiert und mit Admin-Elevation, Revisionskonflikte ablehnen. Öffentliche API liefert ausschließlich veröffentlichte validierte Einstellungen; fehlende Daten erhalten Originaldesign. Medienrechte, Upload-Validierung, Quota und Löschreferenzen vor Freigabe prüfen. Keine Migration oder API in diesem Schritt. Codex soll vorhandene Schema-/Medienfunktionen und Neon-Isolation zuerst prüfen.

## Farbvorlagen und Medienbestand – 58b7c2d / 01ba3e7
Lokale Akzentfarben CFS Cyan (#28d9f0), Violett, Bernstein und eigene Hex-Farbe ergänzt. Nur Vorschau-Rahmen und Überschrift betroffen, Originalbild/Logo unverändert. Reset und ungültige Farbe getestet; erweiterter Mock-Harness erfolgreich im JS-Isolate. Browser und vollständige Node-Suite offen.
Medienbestand geprüft: server.js GET/POST /api/creator/widget-studio/assets delegiert an src/assets.js. listAssets ist kontogebunden (creator_assets.account_id), uploadAsset prüft Anmeldung, MIME, Signatur, Größe, Dateiname und Quota; Speicherung über storeUploadWithRecord. Kategorie background existiert. URL /assets/uploads/... wird ausgegeben. Kein Admin-Website-Medienworkflow daraus ableitbar; vor Wiederverwendung Eigentum, öffentliche Freigabe, tatsächliche Storage-Dauerhaftigkeit, Bilddekodierung, Referenzen und Löschung prüfen. Admin bundle-factory ausdrücklich deaktiviert. Fehlende API-Routen liefern 501; bisherigen Mock um 501 erweitern. Keine neuen Uploads, API-Routen oder Migrationen. Nächster Schritt: Review der Branch-Differenz und isolierte Abnahme vorbereiten.

## Branch-Review und Abnahme – 2026-11-24
Vor diesem Review: 38 Commits vor main, 0 dahinter, 8 Dateien geändert. Staging-Fix 6 vor/42 hinter main; gemeinsame Änderungsdatei package.json (Testketten bei Integration zusammenführen, nicht überschreiben). Neon-Migrationsbranch 2 vor/43 hinter main, keine gemeinsame Änderungsdatei. Kein tatsächlicher Merge-Test; lokale Codex-Änderungen unbekannt. Commit 125af93 ergänzt 501-Mock (direkte JS-Simulation bestanden). Keine Infrastrukturänderung.
### Abnahme vor Merge
- Lokale Änderungen sichern, git fetch, Branch-Diff und package.json prüfen.
- Node >=20, npm ci und npm run check im isolierten Checkout ausführen; Fehler dokumentieren.
- Startseite und Creator Suite bei 320/375/390/430/768px und Desktop prüfen: Menü, Überlauf, Links, Logo, Tastatur.
- Admin-Vorschau mit erlaubtem Testkonto und ohne Berechtigung prüfen; 401/403/501, Refresh, Bildvalidierung, Reset, Farben, Position, Vorschaugröße, CSP und keine Upload-Anfragen.
- Keine Produktionsdatenbank verwenden; CMS-Speicherung bleibt deaktiviert, bis Backend und Medienfreigabe separat implementiert sind.
- PR-Diff prüfen, keine automatische Zusammenführung oder Veröffentlichung; ausdrückliche Freigabe abwarten.

## Isolierte Design-Validierung – 46112b0 / 766d287 / 375a249
Reines Modul src/website-design-validation.js mit vollständigem Einstellungsobjekt: backgroundAssetId (UUID oder null), shade (Ganzzahl 0–90), position (fünf erlaubte Werte), accent (Hex RGB). Unbekannte Felder und freie URLs abgelehnt. Defaults entsprechen lokaler Vorschau, nicht zwingend tatsächlicher Live-CSS. Testdatei in npm run check integriert; 18 Assertions direkt am abgerufenen Quelltext im JS-Isolate bestanden. Node-Gesamtsuite offen. Validator nicht an API angebunden, keine Eigentums-/Freigabeprüfung; diese muss serverseitig separat erfolgen. Keine Migration. Nächster Schritt: Medienreferenz- und Revisionsvertrag vor Persistenz abstimmen.

## Medien- und Revisionsregeln – e99e5e6 / c1d3441 / f65ee77
Reine Policy-Helfer in src/website-design-policy.js: Eigentümer/ID, validiertes Bild, Löschstatus, ausdrückliche öffentliche Freigabe, erwartete Revision, Löschreferenzen. 22 Assertions direkt am GitHub-Quelltext im JS-Isolate bestanden; npm run check erweitert, vollständige Node-Suite offen. Policy-Felder sind vorgeschlagener Vertrag, nicht vorhandenes DB-Schema. Ausschließlich vertrauenswürdige serverseitige Datensätze übergeben; Admin-Auth und vollständige Referenzen (Entwurf, Live, aufbewahrte Versionen) separat ermitteln. Revision und Löschschutz transaktional mit Sperren/CAS erzwingen; Helfer allein verhindern keine Race Conditions. Keine API, Migration, Speicherung oder Wiederherstellung implementiert. Nächster Schritt: isoliertes Zustandsmodell für Entwurf/Publish/Restore mit Tests, vor DB-Anbindung abstimmen.

## Design-Zustandsmodell – 116fb9f / 7bca645 / 51cef84
Reine Zustandsübergänge initialDesignState/transitionDesign: save ändert Entwurf, publish erzeugt veröffentlichte Revision und Historieneintrag, restore kopiert frühere veröffentlichte Version ausschließlich in Entwurf. Globale Revision bei jedem erfolgreichen Übergang erhöht; Medienregeln und Validierung wiederverwendet. 19 Assertions direkt am abgerufenen Quelltext im JS-Isolate bestanden; npm run check erweitert, vollständige Node-Suite offen. Vertrauenswürdiger Zustand/Medienkontext vorausgesetzt; keine API, Auth, DB, Transaktion oder dauerhafte Historie implementiert. Vor Integration atomare CAS-Updates, vollständige Referenzen, History-Retention und öffentliche Projektion spezifizieren. Keine Infrastrukturänderung.
