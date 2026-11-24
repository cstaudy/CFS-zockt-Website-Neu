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
