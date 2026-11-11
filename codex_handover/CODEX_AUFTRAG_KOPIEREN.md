# VERBINDLICHER CODEX-AUFTRAG – CFS_ZOCKT WEBSITE 3

Du bist für die kontrollierte Weiterentwicklung meiner **aktuellen cfs_zockt Website 3** zuständig. Lies vor Codeänderungen die Dateien `START_HIER.md`, `ARCHIV_QUELLEN.md`, `VERGLEICHSBERICHT.md`, `ANFORDERUNGEN_UND_ABNAHME.md`, `FEATURE_ENTSCHEIDUNGSMATRIX.csv`, `DATEIVERGLEICH.csv` und sieh dir **alle 6 Bilder** in `referenzbilder/` und die Markenassets in `brand/` tatsächlich an.

## 1. Unverrückbare Codebasis / kein blindes Merge
- Die einzige Master-Codebasis ist **`CFS-zockt-Website-Neu-main (3).zip`** (Website 3). Keine alten ZIP-Dateien darüber extrahieren; keine vollständigen Server, CSS/JS-Bundles oder Datenbanken aus den alten Projekten ersetzen.
- Die drei anderen Archive sind **Read-only-Vergleichsquellen**. `CFS_Zockt_Website-NEU-main.zip` und `(1).zip` sind inhaltlich identisch; deduplizieren.
- Bestehende URLs, HTML-Seiten, IDs, Einstellungen, Benutzerkonten, Datenflüsse, Zugriffsregeln, APIs, Datenbankschemata und gespeicherten Creator-Projekte erhalten. Keine breaking migrations ohne nachvollziehbaren Plan und Migrations-/Rollback-Test.
- Starte mit Git-Branch, Backup, Laufzeitinventar, Test-Baseline und schriftlichem Plan. Stelle bestehende Funktionen nicht als funktionsfähig dar, nur weil Code vorhanden ist.

## 2. Vergleich/Übernahme – strikt selektiv
Analysiere das alte separate `cfs-zockt-Website-main.zip` (u.a. `public/`, `launcher/`, `tools/`, `ops/`, Tests), sowie die ältere NEU-Version mit ihren 44 exklusiven Dateien. Erstelle für jeden Kandidaten einen Eintrag in `FEATURE_ENTSCHEIDUNGSMATRIX.csv` (oder einem ergänzten Bericht) mit:
  **Feature/Quellpfad**, **Zielbereich**, **bereits in Website 3?**, **in Website 3 funktionsfähig?**, **realer Nutzwert**, **technische Abhängigkeiten**, **Sicherheits-/Datenschutz-/Wartungsrisiken**, **Entscheidung: übernehmen/integrieren/verwerfen/verschieben**, **Begründung**, **Testnachweis**.
**Nur übernehmen**, wenn Website 3 die Funktion nicht bereits hinreichend besitzt, die Funktion logisch zur cfs_zockt-Produktvision passt, sich ohne Regression sauber integrieren lässt und Tests existieren/ergänzt werden. Bei Duplikat die **bestehende** Funktion verbessern statt zweite Implementierung hinzufügen. Bei Unsicherheit Kandidat als offen kennzeichnen; nicht blind portieren.
Prüfe besonders: OBS-/Launcher-Verbindung, Streaming- und Aufnahmefunktionen, Szenen-/Audio-/Widget-/Cut-Werkzeuge, Multichat, Backup/Recovery, automatisierte Tests, Accessibility und Deploymentchecks. Prüfe, ob ältere CSS/JS-Dateien noch genutzte Funktionalität enthalten oder ob sie bewusst ersetzt sind. Keine unabhängige Desktop-Laufzeit als Websitefeature ausgeben.

## 3. Verbindliche Designreferenz
Die **6 PNGs im Ordner `referenzbilder/`** sind die freigegebenen optischen Zielbilder:
1. `01_startseite.png` – Startseite mit Über mich, letzten 3 Spielen, Discord, TikTok **und Twitch**;
2. `02_anmeldung.png` – Login/Registrierung;
3. `03_creator_dashboard.png` – Creator Dashboard;
4. `04_creator_suite_streaming_setup.png` – Creator Suite/Streaming-Setup;
5. `05_account_einstellungen.png` – Account;
6. `06_admin_bereich.png` – Admin.
**Designhierarchie:** Layout-/Stilrichtung der sechs freigegebenen Vorschauen, echtes rundes CFS-Logo aus `brand/`, vorhandener dunkler bergiger Cyan-Wasser-Hintergrund aus `brand/`, reale Texte/Daten/Funktionen des Master-Projekts. Falls Mockup-Text, Icons oder illustrative Kennzahlen von realen Daten/Barrierefreiheit abweichen: reale Daten und gute UX haben Vorrang. Keine Kopie eingebrannter Mockup-Zahlen.
Schaffe ein **gemeinsames Designsystem**: dunkles Marineblau, Cyanblau, Weiß; matte, scharfe Typografie ohne übertriebene Glows; konsistenter Header, Sidebar, Karten, Buttons, Inputs, Tabellen, Status-Chips, Navigation, Abstände, responsives Verhalten und sichtbare Fokuszustände. Original-Logo nicht frei nachzeichnen/ersetzen. `index.html` und alle vorhandenen `pages/*.html` auf die Einheitlichkeit prüfen, nicht nur sechs Demo-Seiten erstellen.

## 4. Inhalte und Integrationen
- Startseite: Kurzvorstellung, **letzte 3 tatsächlich gespielte Spiele** nur aus gültiger Quelle, Discord-Mitglieder, TikTok-Follower, Twitch-Kanal und echter Live-/Offline-/Unbekannt-Status. Wenn Quelle nicht verbunden: eindeutig „Nicht verfügbar“, „Noch nicht verbunden“ oder neutraler Lade-/Fehlerzustand. **Niemals Fake-Livezahlen oder Demo-Spiele als echte Daten ausgeben.**
- Twitch: vorhandene `src/twitch.js`, `src/public-twitch.js`, vorhandene DB-Migrationen, OAuth und Community/Kanal-Verknüpfung prüfen und wiederverwenden. Twitch-Kanal-Link `https://www.twitch.tv/cfs_zockt` nur nach Prüfung der Projektvorgabe. Secrets ausschließlich serverseitig; API-Funktion live nur dann als bestätigt melden, wenn authentisch getestet.
- TikTok, PlayStation, Discord: vorhandene Schnittstellen für echte Daten testen; fehlende Zugänge als offene Abhängigkeit ausweisen.
- Login: **keinen Discord-OAuth-Loginbutton**; Discord-Community-Verlinkung bleibt möglich. Bestehende sichere Login-, Registrierung-, Recovery-, Rollen-/Session-Funktionen erhalten.
- Creator Suite, Account, Admin, Shop: existierende Abläufe nicht durch statische Mockups ersetzen; Rollen und sensible Aktionen prüfen. Keine neue Payment-Integration ohne gesonderte technische Prüfung.

## 5. 31 Streamdesigns – ehrlich mit fehlenden Originalassets umgehen
31 Namen/Katalogwelten × 16 Farbvarianten sind in der Website verzeichnet. 496 WebP-Vorschau-Dateien repräsentieren laut Dateihashes **nur 32 unterschiedliche Bildinhalte**. Die echte private Original-ZIP mit vollständigen animierten Motiven wurde in den vier verglichenen Archiven nicht gefunden. **Erkläre die Vorschauen nicht als Originaldesigns oder 496 einzigartige Artworks.** Bestehende IDs, Nutzerdaten und Editor-Funktionen erhalten. Fehlende Assets in der UI transparent markieren. Ein Neuentwurf aller Motivwelten bedarf eines ausdrücklichen separaten Kreativauftrags; erfinde nicht stillschweigend 31 „Originale“. Für spätere Umsetzung planen: pro Motiv eigenes Artwork; `Stream startet`, `Streampause`, `Streamende` und Farbwechsel als dynamische Ebenen, nicht Tausende duplizierte Bilddateien.

## 6. Arbeitsablauf / Pflichtnachweise
**Phase 0:** Git-Backup, Repository-Dateiinventar, lokale Startversuche, Test-/API-/Migration-/Abhängigkeits-Baseline; Fehler dokumentieren.
**Phase 1:** Funktionsinventar aller 50 HTML-Unterseiten plus APIs, Buttons/Links und Berechtigungen; separate Read-only-Differenzanalyse älterer Projekte und erste Übernahme-Matrix.
**Phase 2:** Priorisierte, testbare Entscheidungen: nur klar sinnvolle fehlende Funktionen mit minimalem Integrationsrisiko selektiv portieren; Einzelfall-Commits, Regressionstests, ggf. Feature Flags.
**Phase 3:** Gemeinsames Designsystem, Startseite und anschließend übrige Seiten nach den sechs Referenzbildern; bereits existierende Features vollständig erhalten.
**Phase 4:** Integrationen, Editor, Sicherheit, responsive Tests und visuelle Screenshots (Desktop/Mobile), Screenshotvergleich, Fehler-/Leerzustände, Dokumentation.

**Vor jeder Änderung** betroffene Funktionen, Dateien und Risiko notieren. **Nach jeder Änderung** relevante Tests erneut ausführen. Kein Überschreiben von Secrets, kein unkontrollierter DB-Reset, keine erfundenen positiven Testresultate. Wenn Ausführung mangels Credentials/DB nicht möglich ist, klar „ungetestet“ vermerken.

## 7. Abgabeformat
Liefere eine PR/Branch mit: (a) aktuellem Funktionsinventar, (b) ausgefüllter Feature-Entscheidungsmatrix, (c) Liste exakt übernommener/geänderter Funktionen und Quellpfade, (d) Design-Screenshots aller 6 Referenzbereiche plus repräsentative Mobilansichten, (e) durchgeführte Tests mit Pass/Fail/Blocked, (f) offenen Abhängigkeiten für Twitch/PlayStation/TikTok/Discord/31 Designs, (g) Rollback-Informationen. **Nicht als fertig melden**, solange eine Änderung bestehende Funktionen bricht oder ein Mockup nur statisch aussieht.
