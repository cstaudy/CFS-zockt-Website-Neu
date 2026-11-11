# Anforderungen, Abnahmekriterien und Risiko-Leitplanken

## Grundsatz
**Master:** Website 3. **Referenz:** 6 Wunschdesigns. **Alte Projekte:** nur selektiv sinnvolle fehlende Funktionen. **Keine stillen Funktionsverluste.**

## P0 – Bestandsaufnahme / technische Stabilität
- [ ] Git-Stand/Archiv-SHA, Node-/NPM-Version und lokaler Start protokolliert; keine Secrets committed.
- [ ] Exakte Seiten-/Routen-/API-Matrix mit Status: vorhanden; implementiert/ungetestet; funktionsfähig; defekt; fehlt.
- [ ] Datenbankmigrationen (21 vorhandene SQL-Dateien), DB- und Session-Sicherheit, Role Based Access geprüft.
- [ ] Baseline-Screenshots/Tests vor Änderungen, Regressionstest nach Änderungen; nicht belegte Zustände „blocked“.

## P1 – Optische Identität
- [ ] Alle sechs Referenzansichten sichtbar verglichen, nicht nur referenziert; echte Website statt alleinstehender Demo geändert.
- [ ] Rundlogo und Berg-/Wasser-Hintergrund aus diesem Paket als echte Assets verwendet.
- [ ] Wiederverwendbare UI-/Design-Tokens statt sich widersprechender CSS-Layer.
- [ ] Startseite und alle bestehenden Unterseiten optisch kohärent, semantische Navigation und mobile Breakpoints.
- [ ] Lesbare matte Typografie, AA-Kontrast möglichst erreicht, Tastaturbedienung/Fokus und Formularfehlermeldungen.
- [ ] Pixelvergleich nicht blind auf Zahlen/Texte übertragen: Mockups sind visuelle Leitlinie, keine Live-Datenquelle.

## P1 – Funktionalität und Integrationen
- [ ] Vorhandene Twitch-Implementierung verwendet; OAuth und Live-Status mit echten Testdaten geprüft oder ausdrücklich offen.
- [ ] TikTok-/Discord-/PlayStation-Daten: nachweislich echt oder eindeutig leer/nicht verbunden.
- [ ] Login/Recovery/MFA/Session/Rollen weiter funktionsfähig; kein Discord-Loginbutton.
- [ ] Stream Studio, OBS, Editor, Widget, Audio, Projekte und Export mit End-to-End-Prüfpunkten.
- [ ] Shop/Admin sensible Aktionen nur durch autorisierte Rollen; nicht getestete Käufe nicht als produktionsbereit bezeichnen.

## P1 – Selektive Altfeature-Übernahme
Jeder Kandidat braucht **nachweisliche Lücke**, echten Mehrwert, kompatible Schnittstelle, passende Lizenz/Rechte, Sicherheitsprüfung, Einzelscope und Tests. Wenn vorhandene Funktion gleichwertig ist: **verwerfen oder bestehende verbessern**, nicht verdoppeln. Desktop-/Launcher-Module nur in einem klar begründeten Desktop-/API-Kontext integrieren; nichts im Browser versprechen, was nur ein Desktop-Programm kann.

## P2 – 31 Designs
- [ ] 31 Katalog-IDs und 16 Farbvarianten erhalten.
- [ ] Keine falsche Kennzeichnung wiederholter WebPs als vollständige Originale.
- [ ] Fehlende Original-Assets/Animationen in offener Liste aufgeführt; Neugestaltung erst nach gesonderter Freigabe.
- [ ] Konzeption für dynamische Zustände Start/Pause/Ende, Farbpaletten und separate Mastermotive festhalten.

## Pflicht-Abgabe
1. Feature-Matrix mit dokumentierten Entscheidungen.
2. Liste aller betroffenen Codepfade und API-/DB-Änderungen.
3. Screenshots (Desktop, Mobile) inkl. direktem Vergleich zu den sechs Referenzen.
4. Testprotokoll: Kommando, erwartetes Ergebnis, Ist-Ergebnis, Status PASS/FAIL/BLOCKED.
5. Liste real offener Credentials/Provider-Rechte/Designassets ohne Geheimnisse.
6. Kurzbeschreibung, wie sich Änderungen rückgängig machen lassen.
