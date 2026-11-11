# CFS Zockt — Vergleich von 4 hochgeladenen Website-Archiven

**Prüfdatum:** 11. November 2026  
**Verbindlicher Ausgangspunkt:** `CFS-zockt-Website-Neu-main (3).zip` (**Website 3**, vom Auftraggeber als aktuelle Website benannt).  
**Prüfverfahren:** ZIP-Dateilisten, nach Entfernen der jeweiligen ZIP-Wurzelverzeichnisse normalisierte Pfade, SHA-256-Vergleich des tatsächlichen Dateiinhalts, Code-/Konfigurationsprüfung. Keine gestartete Live-Website, keine externen OAuth-Anmeldungen und keine Datenbank-Abfrage.

## 1. Die Archive auf einen Blick

| Kennung | Datei | Dateien | Unkomprimiert | Rolle |
|---|---|---:|---:|---|
| A | `cfs-zockt-Website-main.zip` | 1.065 | 26,95 MB | Eigenständige ältere Komplettarchitektur mit `public/`, `lib/`, `launcher/`, `tools/`, `ops/` und GitHub-Workflows |
| B | `CFS_Zockt_Website-NEU-main (1).zip` | 916 | 20,16 MB | Statische Website mit Seiten, CSS/JS, Design-Vorschauen; kein eigener `server.js` |
| C | `CFS_Zockt_Website-NEU-main.zip` | 916 | 20,16 MB | **Bytegenau dieselben 916 Dateien wie B** |
| D | `CFS-zockt-Website-Neu-main (3).zip` | 1.086 | 20,58 MB | **Aktuelle Website 3:** statische Website plus Node.js-/PostgreSQL-Backend und Schnittstellen |

**Entscheidung:** Nur D ist die Basis für die Weiterentwicklung. A, B und C sind ausschließlich Informations-/Rettungsquellen; nicht blind zusammenkopieren.

## 2. Präziser Dateivergleich (D gegenüber B/C)

| Ergebnis | Anzahl |
|---|---:|
| Inhaltlich identische Dateien | 844 |
| Gleiche Pfade, aber geänderter Inhalt | 28 |
| Nur in aktueller Website 3 | 214 |
| Nur in früherer NEU-Website | 44 |

Unter den 214 neuen Dateien befinden sich **141 Einträge im Ordner `node_modules`**. D enthält außerdem `server.js`, `package.json`, `src/`, `migrations/` und neue Integrations- und Backend-Dokumentation. B und C enthalten keinen vergleichbaren vollständigen Backend-Quellbaum. Die 44 entfallenen Dateien sind nicht automatisch verlorene Funktionen: einige ältere CSS-/JS-Versionen können bewusst ersetzt oder zusammengelegt sein. Jede tatsächlich genutzte Datei muss im HTML-/JS-Abhängigkeitsgraph geprüft werden.

**Die 28 geänderten Pfade:**

- `assets/css/cfs-brand-v198.css`
- `assets/css/cfs-product-v199.css`
- `assets/css/launcher.css`
- `assets/css/styles.css`
- `assets/css/widget-studio.css`
- `assets/js/cfs-r14-admin-overview.js`
- `assets/js/cut-studio.js`
- `assets/js/stream-studio.js`
- `assets/js/widget-studio.js`
- `index.html`
- `pages/account.html`
- `pages/admin.html`
- `pages/beta-feedback.html`
- `pages/creator-suite.html`
- `pages/cut-studio.html`
- `pages/dashboard.html`
- `pages/design-vorschau.html`
- `pages/integrations.html`
- `pages/launcher.html`
- `pages/login.html`
- `pages/obs-setup.html`
- `pages/shop.html`
- `pages/stream-maker.html`
- `pages/stream-studio.html`
- `pages/tiktok.html`
- `pages/universal-builder.html`
- `pages/website-abnahme.html`
- `pages/widget-studio.html`

**Die 44 nur in B/C enthaltenen Pfade:**

- `README.md`
- `assets/css/billing.css`
- `assets/css/cfs-accessibility-v12.css`
- `assets/css/cfs-dashboard-v9.css`
- `assets/css/cfs-empty-v7.css`
- `assets/css/cfs-forms-v10.css`
- `assets/css/cfs-home-v13.css`
- `assets/css/cfs-mobile-v11.css`
- `assets/css/cfs-nav-v8.css`
- `assets/css/cfs-r104-home.css`
- `assets/css/cfs-r106-public.css`
- `assets/css/cfs-r107-games.css`
- `assets/css/cfs-r119-public.css`
- `assets/css/cfs-r152-community.css`
- `assets/css/cfs-r17-ui.css`
- `assets/css/cfs-r18-workflow.css`
- `assets/css/editor.css`
- `assets/css/game-runtime.css`
- `assets/css/scene-runtime.css`
- `assets/css/stream-maker-output.css`
- `assets/css/widget-runtime.css`
- `assets/js/admin-bundle-factory-v175.js`
- `assets/js/admin-bundle-factory-v176.js`
- `assets/js/admin-bundle-factory-v177.js`
- `assets/js/billing-plans.js`
- `assets/js/cfs-accessibility-v12.js`
- `assets/js/cfs-admin-private-download-v32077.js`
- `assets/js/cfs-dashboard-v9.js`
- `assets/js/cfs-empty-v7.js`
- `assets/js/cfs-forms-v10.js`
- `assets/js/cfs-game-runtime.js`
- `assets/js/cfs-gaming-home-v112.js`
- `assets/js/cfs-home-v13.js`
- `assets/js/cfs-mobile-v11.js`
- `assets/js/cfs-nav-v8.js`
- `assets/js/cfs-public-content-v181.js`
- `assets/js/cfs-r104-home.js`
- `assets/js/cfs-r18-workflow.js`
- `assets/js/cfs-scene-runtime.js`
- `assets/js/cfs-widget-runtime.js`
- `assets/js/page-shop-original-designs-v32065.js`
- `assets/js/site.js`
- `assets/js/stream-maker-output.js`
- `assets/js/widget-follower-goal.js`

Die komplette Pfadliste mit allen 1.130 unterschiedlichen Pfaden liegt zusätzlich als CSV bei: `cfs_zockt_dateivergleich.csv`.

## 3. Unterschiede nach Website-Bereich

| Bereich | A – separates Hauptprojekt | B/C – statische Website | D – aktuelle Website 3 | Bewertung und nächste Aktion |
|---|---|---|---|---|
| Öffentliche Homepage | `public/index.html`, viel Automatisierungs-/UI-Code | `index.html`, UI-Dateien | `index.html`, zusätzliche Home-CSS/JS und API | **D behalten**, gegen freigegebene Bilder vergleichen, Live-Daten statt Zahlen-Fakes |
| Anmeldung / Account | Umfangreiche Authentifizierung, Schutz-/Prüfskripte | Login-/Account-Seiten als Frontend | Login-/Account-Seiten + Auth-Modul, Sessions, MFA/Passkeys-Routen | D-Funktionalität prüfen; keine alten Servermodule ungeprüft übernehmen |
| Creator Dashboard | Creator Suite + Launcher | Dashboard-/Creator-Seiten | Dashboard-/Creator-Seiten + Datenbankmodule | D weiterentwickeln und Visuals vereinheitlichen |
| Stream Studio / OBS | Sehr umfangreicher `launcher/`-Bereich mit Streaming-Engine, OBS, Recording, Multichat u. Tests | Browserseiten und diverse Assets | Stream Studio/OBS-Oberfläche + `src/studio-adapter.js` / Launcher-Endpunkte | **Aus A besonders relevante Funktionen prüfen**; Website 3 ist nicht automatisch vollwertiger Stream-Engine-Ersatz |
| Widget / Scene / Cut / Audio | Tests, Desktop-/Laufzeitkomponenten | UI-Seiten und Scripts | UI-Seiten + API-Adapter und Projekte | Kernabläufe Ende-zu-Ende testen; ggf. selektiv migrieren |
| Twitch | Provider-/Launcher-Code, Konfiguration | UI-Vorbereitungen | `src/twitch.js`, `src/public-twitch.js`, Migration `006_twitch_oauth.sql`, Serverrouten | **Code vorhanden, Live-Anbindung nicht bewiesen**; OAuth/App-Credentials/Callback testen |
| TikTok | Backend-/Provider-Code | TikTok-Seiten | `src/tiktok.js`, TikTok-UI, Migrationsdateien | Zugangsdaten + Redirect-URLs + echte API-Antworten prüfen |
| Discord | Öffentliche Community-Angaben/Konzept | UI-/Community-Elemente | `GET /api/public/community-stats` | Nur Community-Link/Statistik; **kein Discord-OAuth-Login** einführen |
| PlayStation / letzte Spiele | ggf. einzelne Konzepte | nicht dieselbe vollständige Backend-Stufe | `src/playstation.js`, Home-Module, `007_playstation_catalog.sql`, neue PlayStation-Seite | Echte Zuordnung/Autorisierung und Quelle für die letzten 3 Spiele prüfen |
| Shop / Monetarisierung | Stripe/Billing-/Sicherheitsprüfungen und große Release-Toolkette | Shop-/Planseiten | Shop-Seiten, `src/paypal.js`, Bestellmigrationen | Checkout nur bei verifizierter Berechtigung/Aktivierung; Payment-Logik nicht blind mischen |
| Admin | Desktop-Admin, Audits, weitere Tools | Webadmin | Webadmin und Admin-API | Berechtigungen, Datenfluss, Audit und sensible Aktionen testen |
| Deployment, Backup, Tests | `tools/` (363 Dateien), `.github/`-Workflows, `ops/`, Recovery | größtenteils statische Dateien | Render-Hinweise, `scripts/`, `migrations/`, aber kaum vergleichbare Tests | **Wichtigste Übernahmechance aus A:** Testideen, Release-Checks, Betriebsdokumentation; vorher Architektur anpassen |

## 4. Konkreter Stand der 31 Streamdesigns

- In B, C und D liegen jeweils **496 WebP-Vorschaudateien** in `assets/img/cfs-original-design-previews/`.
- Die Dateien sind auf **31 Hauptdesignordner × 16 benannte Farbvarianten** verteilt.
- Per SHA-256 ergeben sich **nur 32 unterschiedliche WebP-Bildinhalte** unter diesen 496 Dateien. Unterschiedliche Dateinamen sind hier kein Nachweis unterschiedlicher Motive.
- Die Katalogdateien liegen in `assets/data/`, unter anderem `cfs-original-design-previews-r13.json` und `original-design-catalog-v32065.json`.
- Der Vorschaukatalog bezeichnet WebP-Dateien ausdrücklich nur als **Vorschauen** und nennt ein **separates privates Originalarchiv** für PNG-Originale.
- Das Katalogfeld `source_archive` verweist auf `resources/original-designs/Streaming-Gesamtpaket-31-Designs-496-Farbvarianten-Animiert-DE.zip`; die Datei ist **in keinem der vier hier verglichenen Archive enthalten**.
- **Nicht bestätigt:** 31 eigenständige Originalmotive, Original-PNGs, funktionsfertige animierte Start/Pause/Ende-Szenen, 496 kreative Einzelmotive. Es ist deshalb irreführend, die Vorlagen als vollständiges Originalpaket zu bezeichnen.
- A enthält `ORIGINAL-DESIGNS-INFO.txt` mit einem Hinweis auf das Originalarchiv, aber nicht das archivierte Gesamtpaket selbst. A enthält andere WebP-Dateien, nicht den nachgewiesenen 31×16-Originalsatz.

**Erforderlich:** Entweder das echte Originalarchiv aus anderem Speicher/Backup beschaffen **oder** die 31 Motivwelten neu gestalten und die Rechte/Quellen dokumentieren. Danach aus jedem Hauptmotiv 3 Streamzustände (Start/Pause/Ende) mit dynamisch einstellbaren Farben ableiten. Nicht 31×16×3 nahezu identische Dateien generieren.

## 5. Technische Befunde zur aktuellen Website 3

- `package.json`: Node.js-ES-Module, `pg`, Start über `scripts/start.js`, Schema-/Runtime-Code in `server.js` und `src/`.
- 21 SQL-Dateien `migrations/001_initial.sql` bis `migrations/021_creator_settings.sql` plus Migrations-README sind vorhanden.
- Backendreferenz `BACKEND-README.md` nennt API-Routen und weist ausdrücklich darauf hin, dass bestimmte Bereiche noch `501 API_NOT_IMPLEMENTED` liefern. **Ein vorhandener API-Pfad bedeutet nicht zwingend eine funktionierende Funktion.**
- Twitch-Quellcode enthält getrennte Funktionen für Nutzer-Verknüpfung (`src/twitch.js`) und öffentliche Live-Abfrage (`src/public-twitch.js`). Benötigt serverseitige `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, passende Redirect-URI. Ohne gültige Credentials kann die öffentliche Abfrage auf Fallback/Offline zurückfallen.
- TikTok nutzt analog OAuth-Variablen, PlayStation eine eigene Integration; auch diese Schnittstellen sind ohne produktive Schlüssel und Tests nicht als live zu bewerten.
- Die `.env.example` ist eine **Vorlage** und kein Nachweis, dass produktive Secrets existieren. Echte Geheimnisse dürfen nicht in die ZIP-/Git-Historie gelangen.
- `node_modules/` im Quellarchiv ist für reproduzierbare Entwicklung ungünstig; mit `npm ci` aus einem geprüften Lockfile installieren, Abhängigkeiten aus dem Repo ausnehmen.
- Es wurden **keine** Datenbank, Live-Seite, echte OAuth-Verknüpfung, Spiel-/Follower-Zahlen, Zahlungen oder Desktop-OBS-Streams in dieser Analyse ausgeführt.

## 6. Was genau noch benötigt wird

| Priorität | Bedarf | Warum | Quelle/Aktion |
|---|---|---|---|
| **P0** | Gesicherter Master-Stand D und funktionierender Start-/Testlauf | Datenverlust verhindern, echten Ist-Zustand ermitteln | Website 3 in Git als Ausgangspunkt; `npm ci`, Migrations-/Starttests lokal oder Staging |
| **P0** | Designreferenzen (6 Freigabebilder), Original-CFS-Rundlogo, Berg-/Wasserhintergrund | Einheitlichen Look statt mehrerer CSS-Generationen herstellen | Vorhandenes Freigabepaket; Pfade/Farbpalette dokumentieren |
| **P0** | Datenbank/Deployment-Informationen **ohne Secrets im Chat/Repo** | Prüfen, ob Website-3-Backend wirklich Daten speichert und bereit ist | Render-/Hosting-Umgebung, DB-Migrationen, Staging |
| **P0** | Inventar aller UI-Routen, Assets und Button-Aktionen | Keine funktionierende Unterseite beim Redesign verlieren | Automatisierte Route-/Linktests und Screenshots aller 50 `pages/*.html` |
| **P1** | Nachweis originaler Streammotive bzw. Freigabe zur Neugestaltung | Der 31er-Katalog enthält nur weitgehend wiederholte Vorschauen | Altes privates Designarchiv/Backups oder neue Gestaltungsvorgaben |
| **P1** | Twitch-Developer-App, freigegebene Redirect-URI, öffentliche Kanalzuordnung | Twitch-Kanal, Live-Status und Account-Verbindung echt testen | Einstellungen im Twitch Developer Portal/Server, keine Secrets in Dokumenten |
| **P1** | TikTok-/PlayStation-API-Freigaben und echte Datenquellen | TikTok-Follower und letzte 3 Spiele korrekt darstellen | Provider-Konfiguration und Authentifizierung |
| **P1** | Discord-Server-/Widget-Quelle für reale Mitgliederstatistik | Keine erfundenen Zahlen | Discord-Einladung/API-Berechtigung; kein Login per Discord |
| **P1** | Gezielte Featureprüfung des A-Launchers, der OBS-/Audio-/Stream-Engine und Tests | Potenziell nützliche Fähigkeiten älterer Architektur | A in separatem Ordner, Portierung nur nach Schnittstellenvergleich |
| **P2** | Shop-/Payment-Freigaben, Rechtstexte, Sicherheits- und Betriebsprüfung | Käufe nur mit getesteter produktiver Zahlungs- und Datenschutzlogik | Provider-/Rechtstests, Backup-/Recovery-Konzept |

## 7. Empfohlene Weiterentwicklung in Reihenfolge

1. **Website 3 einfrieren:** Backup/Commit, Start- und API-Smoketests, Datenbankschema feststellen. Keine alten Archive darüber entpacken.
2. **Designsystem aufbauen:** zentrale CSS-Tokens/Komponenten für Navy/Cyan, matte Schrift, Original-Rundlogo, Berg-/Wasserhintergrund, gemeinsame Header/Navigation/Footer.
3. **Startseite als Referenzseite fertigstellen:** mit echten API-Zuständen bzw. klar als nicht verbunden gekennzeichneten Platzhaltern, Twitch/Discord/TikTok und letzten drei Spielen.
4. **Weitere Seitentypen migrieren:** Login/Registrierung, Dashboard, Creator Suite/Streaming, Account, Admin, Shop und übrige Seiten. Alle 50 Seiten von `pages/` prüfen, auch wenn sie später gruppiert werden.
5. **Bestehende Integrationen funktionsfähig machen:** Twitch zuerst, dann TikTok, Discord-Stats, PlayStation. OAuth-Schlüssel nur serverseitig.
6. **Design-Galerie sanieren:** 31 Motive erst nach Original-Fund oder neuem kreativen Auftrag aufbauen. 3 Zustände und Farbsteuerung implementieren; Vorschauen korrekt kennzeichnen.
7. **A als Referenz auswerten:** ausgewählte Launcher-/OBS-/Audio- und Testmodule portieren, aber niemals blind Backend/Server/Abrechnungssysteme vermischen.
8. **Visuelle und funktionale Abnahme:** Screenshots gegen die 6 freigegebenen Referenzen sowie Mobile/Tablet/Desktop; Links, Rollen, API, Shop, Integrationen, Performance und Sicherheits-/Backup-Checks.

## 8. Regeln für Codex

> Nutze ausschließlich `CFS-zockt-Website-Neu-main (3).zip` als aktuelle Codebasis. Die beiden NEU-Archive B/C sind identische ältere Stände; `cfs-zockt-Website-main.zip` ist eine getrennte Architektur mit möglicherweise hilfreichen Laufzeit-/Testmodulen. Erhalte die vorhandenen Routen und Funktionen, übernimm nichts ungetestet, zeige keine Fake-Live-Zahlen und bezeichne die 496 WebP-Vorschauen nicht als originale Designs. Vergleiche alle UI-Bereiche visuell mit den freigegebenen Referenzbildern. Erfasse für jede Funktion **vorhanden / implementiert aber ungetestet / fehlt / defekt** getrennt und liefere nachvollziehbare Tests.

## 9. Grenzen der Untersuchung

„Vorhanden“ bezeichnet stets **im Archiv gefundenen Quellcode oder Dateien**, nicht eine erfolgreiche Live-Funktionsprüfung. Die exakte visuelle Übereinstimmung konnte ohne gestarteten Webserver nicht verifiziert werden. Fehlen Originaldaten, echte Credentials, Datenbankinhalt oder Produktionszugang, bleibt die entsprechende Funktion bewusst als **ungeprüft** gekennzeichnet.
