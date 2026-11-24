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
