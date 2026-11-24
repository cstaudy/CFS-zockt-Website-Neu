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
