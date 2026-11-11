# VERBINDLICHE CODEX-ANWEISUNGEN – CFS ZOCKT WEBSITE 3

## Bevor du irgendeinen Code änderst
1. Lies diese Datei, `CODEX_START_HIER.md` und `codex_handover/CODEX_AUFTRAG_KOPIEREN.md` vollständig.
2. Betrachte die Bilder `codex_handover/referenzbilder/01_startseite.png` bis `06_admin_bereich.png` und die echten Markenassets in `codex_handover/brand/`. Nur diese Bilder sind visuelle Freigaben; keine neue Bildsuche als Ersatz.
3. Lies den vorhandenen Architektur- und Versionsvergleich sowie `codex_handover/FEATURE_ENTSCHEIDUNGSMATRIX.csv`.
4. Inventarisiere die laufende Anwendung, ihre URLs/Seiten, APIs und Funktionen. Prüfe die Start- und Testbefehle, ohne produktive Datenbanken oder Konten zu verändern.

## Master-Regel
**Alle Quellcodedateien an dieser Projektwurzel gehören zur AKTUELLEN WEBSITE 3.** Verwende sie als einzigen Master. Ältere ZIPs unter `_codex_sources/` sind ausschließlich Vergleichsquellen, nie zur pauschalen Überschreibung. Kein blindes Mergen und keine neue Website parallel neben der bestehenden aufbauen.

## Selektive Feature-Übernahme
Nur fehlende, zum Produkt passende und technisch sichere Funktionen aus alten Versionen übernehmen. Zuerst auf bereits vorhandene Entsprechungen prüfen; bei Duplikaten die bestehende Funktion verbessern statt eine zweite Implementierung zu schaffen. Für jedes Feature Ziel, Nutzen, Risiken, Abhängigkeiten, Entscheidung und Tests in `codex_handover/FEATURE_ENTSCHEIDUNGSMATRIX.csv` bzw. einem Ergebnisbericht dokumentieren. Keine ungeprüften OBS-/Launcher-Desktopfunktionen als funktionierende Websitefeatures ausweisen.

## Verbindliche Optik
Nutze die sechs freigegebenen Designbilder in `codex_handover/referenzbilder/` als Layout-/Stilreferenz, die Originaldateien aus `codex_handover/brand/` für rundes CFS-Logo und Berg-/See-Hintergrund. Dunkles Marineblau, Cyan und Weiß; klare matte Typografie, wenig Glow; gemeinsames responsives Designsystem. Bestehende Funktionen erhalten. Betrachte Mockup-Zahlen und -Spiele als Illustrationen, nicht als echte Daten. Twitch sichtbar integrieren; keine Discord-OAuth-Anmeldung.

## Streamdesigns
31 Hauptdesigns und 16 Farbvarianten im vorhandenen Katalog erhalten. 496 WebP-Dateien sind nur 32 unterschiedliche Bildinhalte; das vollständige animierte Originalarchiv ist nicht in diesen Dateien nachgewiesen. Niemals behaupten, Platzhalter seien echte Originalmotive. Ohne gesonderte Zustimmung keine erfundenen Originaldesigns einbauen.

## Ausführungsprozess und Übergabe
Erstelle zunächst eine Baseline, Tests und Plan; arbeite in kleinen, nachvollziehbaren Änderungen; nach jeder Änderung testen; danach echte Screenshots der laufenden Seiten mit den Referenzen vergleichen. Bei nicht konfigurierten externen APIs oder DB nur `blocked`/`ungetestet` melden. Geheimnisse nie ausgeben/einchecken, keine Datenbank zurücksetzen, keine produktiven Migrationen ohne Prüfung. Liefere genaue Liste der Änderungen/Übernahmen, Tests, offene Risiken/Abhängigkeiten, Screenshots und Rollback-Pfad. Details stehen in `codex_handover/CODEX_AUFTRAG_KOPIEREN.md`.

## Repository-Hygiene
Ändere die Dateien in dieser Wurzel statt Kopien in `codex_handover/` oder `_codex_sources/`. Die Unterordner dienen als Referenzen. Trage Quelländerungen nicht in alte ZIPs ein. Vermeide `.env`-Secrets im Repository.
