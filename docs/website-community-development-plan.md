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
