# CFS Zockt – zentrale Entwicklungsübersicht

Stand: 28.11.2026
Arbeitsbranch: `security/staging-neon-tls-20261125`
Ausgangs-HEAD dieses Arbeitspakets: `c84c549348c59811eba537c0c605b8306ffccff4`

## Statuswerte

- **OFFEN** – noch nicht begonnen oder nicht ausreichend spezifiziert
- **IN ARBEIT** – aktuell bearbeitet
- **IMPLEMENTIERT** – Quellcode oder Dokumentation ist vorhanden
- **GETESTET** – der relevante lokale Test ist erfolgreich gelaufen
- **BLOCKIERT** – eine externe Abhängigkeit oder eine ausdrücklich nicht erlaubte Ausführung fehlt
- **ABGESCHLOSSEN** – implementiert, getestet, dokumentiert und ohne offene Abnahmebedingung

## Baseline und Teststand

| Bereich | Status | Tatsächlicher Nachweis / offene Grenze |
|---|---|---|
| Repository und Entwicklungsbranch | GETESTET | Checkout auf `security/staging-neon-tls-20261125`; dieser Auftrag startete bei `c84c549` |
| Website-3-Mastercode | IMPLEMENTIERT | `index.html`, `server.js`, `src/`, `pages/`, `migrations/` an der Projektwurzel; Archive unter `_codex_sources/` bleiben Read-only-Referenzen |
| HTML-Seiten | IMPLEMENTIERT | 59 HTML-Dateien im Responsive-Vertrag geprüft |
| Datenbankmigrationen | IMPLEMENTIERT | Migrationen 001–027; 026 ist Passwort-Recovery, 027 bindet Launcher-Jobs an das exakt claimende Gerät |
| Automatisierte Prüfung | GETESTET | `npm ci` mit separatem Temp-npm-Cache erfolgreich; vollständiges `npm run check` erfolgreich nach Abschluss dieses Pakets |
| PostgreSQL-18-Integration | BLOCKIERT | Statischer PG18-Backupvertrag und sichere Verweigerung sind getestet; lokale Bash/Docker- und disposable PostgreSQL-18-Abnahme fehlen in dieser Umgebung. Keine produktive DB wurde angesprochen |
| Externe Provider | BLOCKIERT | Twitch, TikTok, PlayStation und Discord-Statistik benötigen echte, nicht im Repository gespeicherte Zugangsdaten bzw. Providerfreigaben |
| Browser-/Screenshot-Abnahme | GETESTET | Öffentliche Startseite und Login wurden bei 320/375/390/430/768/1280/1920 px im lokalen Browser geprüft; bei 768 px wurde die Startseiten-Navigation auf das mobile Menü umgestellt. Geschützte Seiten bleiben ohne Testkonto BLOCKIERT |

## Masterplan nach Funktionsbereich

| Funktionsbereich | Status | Ist-Stand und nächste prüfbare Aufgabe |
|---|---|---|
| Startseite, Über mich, Community, Spiele | GETESTET | Seiten und API-Fallbacks vorhanden; echte Werte werden nur aus bestätigten Quellen angezeigt. Öffentliche Browseransicht visuell geprüft |
| Login und Registrierung | GETESTET | Login-/Registrierungsansicht, Tabs, mobile Darstellung und neutrale Recovery-Einstiegspunkte geprüft |
| Passwort-Recovery | GETESTET | Einmalige Tokenverwendung, Ablauf, transaktionaler Versand, Account-/IP-Limits und parallele Anfragen regressionsgetestet |
| E-Mail-Verifizierung | GETESTET | Sichtbarer Status, erneuter Versand, Resend-Fehler, Ablauf, atomare einmalige Tokenverwendung und parallele Requests im Vertrags-/Concurrency-Test bestanden; Live-Mail-/DB-Abnahme bleibt stagingabhängig |
| Admin-Navigation und Berechtigungen | GETESTET | Gemeinsame Account-Projektion; Admin nur bei übereinstimmender Betreiber-E-Mail, Rolle `admin` und bestätigter E-Mail. Browser-/Live-DB-Abnahme bleibt separat |
| Creator Dashboard und Creator Suite | IMPLEMENTIERT | Werkzeuge, Projekte und API-Adapter vorhanden; authentifizierte Ende-zu-Ende-Abnahme ist ohne isolierte DB/Session BLOCKIERT |
| Stream Studio, Widget, Scene, Cut, Audio | IMPLEMENTIERT | Website- und Persistenzpfade vorhanden; OBS-/Desktop-Funktionen werden nicht als Browserfunktion vorgetäuscht |
| Streamdesign-Katalog | IMPLEMENTIERT | 31 Katalogwelten und 16 Varianten referenziert; vorhandene WebPs sind nur Vorschauen, echte animierte Originalmotive fehlen |
| Twitch / TikTok / PlayStation / Discord | IMPLEMENTIERT | Websitepfade und neutrale Fallbacks vorhanden; reale Provider- bzw. Gerätedaten bleiben BLOCKIERT ohne autorisierte Konfiguration |
| Shop und Zahlungen | BLOCKIERT | Katalog-/PayPal-Vorbereitung vorhanden; kostenpflichtige Käufe bleiben bis Provider-, Rechts- und Abnahmetests gesperrt |
| Datenschutz und Kontowerkzeuge | IMPLEMENTIERT | Sessions, Export, Kontolöschung, MFA- und Passkey-Oberflächen vorhanden; reale Accountabnahme bleibt DB-abhängig |
| Responsive Design und Barrierefreiheit | GETESTET | Gemeinsames Designsystem, Fokus-/Skip-Mechanismen und Breakpoints 980/760/520 vorhanden; Startseiten-Shell nutzt bis 820 px das zugängliche mobile Menü |
| Persistente Speicherung | IMPLEMENTIERT | PostgreSQL-Projekte, Sessions, Upload-Speicher und Quota-Pfade vorhanden; isolierte Ende-zu-Ende-Abnahme noch offen |
| Backup und Wiederherstellung | ABGESCHLOSSEN | Vorheriger Migrationsnachweis mit unabhängiger Neon-Sicherung und isolierter Wiederherstellung bleibt dokumentiert; in diesem Auftrag keine neuen Produktions-Backups |

## Abgleich der GitHub-Entwürfe

Die Entwürfe wurden gelesen und selektiv geprüft. Es wurde kein Pull Request blind gemergt und keine vollständige Datei aus einem Entwurf ersetzt.

| Entwurf | Ergebnis | Übernommene bzw. bewusst nicht übernommene Punkte |
|---|---|---|
| PR #103 Passwort-Recovery | IMPLEMENTIERT / GETESTET | Migration 026, persistente Account-/IP-Limits, deterministische Advisory-Lock-Reihenfolge, neutrale Antworten, Mail-Rollback und Regressionstests übernommen; der vorhandene transaktionale Tokenverbrauch blieb erhalten |
| PR #108 Neon-TLS/Zielprüfung | IMPLEMENTIERT / GETESTET | Striktes `rejectUnauthorized` aus dem bestehenden Code beibehalten; zusätzliche read-only Zielprüfung für exakten Neon-Host, Datenbanknamen, `sslmode=verify-full` und erlaubte URL-Parameter ergänzt |
| PR #109 Migrationssicherheit | IMPLEMENTIERT / GETESTET | Manifestprüfung auf gültige, lückenlose und sortierte Dateinamen vor jedem DB-Zugriff ergänzt; Ledger- und Baseline-Guards bleiben aktiv |
| PR #117 Admin-Sicherheit | IMPLEMENTIERT / GETESTET | Einheitliche `accountAccessView`-Projektion ergänzt; Rollenlisten in Creator Settings entfernt; Passwort-Hashes bleiben außerhalb von API-/Login-Projektionen |
| PR #121 Launcher-Gerätezuordnung | IMPLEMENTIERT / GETESTET | Migration 027 und exakte `claimed_by_device`-Prädikate für Claim/Update ergänzt; E2E-DB-Abnahme bleibt CI-/isoliert-datenbankabhängig |
| PR #107 Entwicklungsplan | ABGEGLICHEN | Roadmap und technische Inventur als Grundlage verwendet; Multi-Publisher bleibt entsprechend der Vorgabe pausiert |

## Aktuelles Arbeitspaket – Nachweis

| Paket | Status | Nachweis / Grenze |
|---|---|---|
| Lockfile-Abhängigkeiten | GETESTET | `npm ci --no-audit --no-fund` mit temporärem Cache außerhalb des Projekts erfolgreich |
| Sicherheitskonsolidierung | GETESTET | Recovery-, E-Mail-, Admin-, Neon-Ziel-, Migrations- und Launcher-Verträge erfolgreich |
| Responsive HTML-Vertrag | GETESTET | 59 Seiten mit `lang` und Viewport-Meta; gemeinsame Breakpoints 980/760/520 |
| Browser-Screenshots | GETESTET | Tatsächliche lokale Browseransichten vor/nach der 768-px-Navigationskorrektur sowie bei den geforderten Breiten; der nachfolgende PNG-Export war nach einem Browserhost-Abbruch nicht wiederholbar und wurde nicht als vollständiger Nachweis ausgegeben. Keine neuen Markenassets oder CSS-Konkurrenzschicht |
| Authentifizierte Creator-/Admin-Seiten | BLOCKIERT | Ohne isolierte synthetische PostgreSQL-18-Datenbank und Session keine verantwortbare praktische Abnahme; unauthentifizierte Aufrufe redirecten erwartungsgemäß zum Login |
| Produktiv veröffentlicht | BLOCKIERT | Kein Produktionsdeployment und kein Merge in `main` im Rahmen dieses Auftrags |

## Sicherheits- und Betriebsgrenzen

- Keine produktive Neon-Datenbank, Render-Umgebungsvariable oder Produktionsbereitstellung wurde verändert.
- TLS bleibt strikt; keine `rejectUnauthorized`-Abschwächung und kein `DATABASE_SSL=false` für entfernte Ziele.
- Keine Passwörter, Token, API-Schlüssel, Dumps oder echten Providerdaten in Git, Chat oder Testprotokollen.
- Keine neuen Originaldesigns oder erfundenen Providerstatistiken.
- Migration 027 muss vor einem Launcher-Produktiveinsatz im Ziel-Ledger vorhanden sein; die Release-Readiness-Prüfung blockiert sonst fail-closed.
- Rollback der Codeänderungen erfolgt über den vorherigen Commit/Branchstand. Datenbankmigrationen und produktive Umschaltungen bleiben separat freigabepflichtig.

## Nächste Arbeitspakete

| Priorität | Paket | Status |
|---|---|---|
| P0 | Isolierte PostgreSQL-18-DB für Migration-/Launcher-/Creator-E2E-Abnahme bereitstellen | BLOCKIERT |
| P1 | Authentifizierte Browserabnahme der Creator-Suite und Admin-Seiten mit synthetischen Konten | BLOCKIERT |
| P1 | Provider-Abnahmen für Twitch, TikTok, PlayStation und Discord | BLOCKIERT |
| P1 | API-/Frontend-Inventar je Seite mit echten Leer-/Fehlerzuständen vervollständigen | OFFEN |
| P2 | Original-Streammotive oder separat freigegebener Kreativauftrag | BLOCKIERT |
| P2 | Multi-Publisher | BLOCKIERT / pausiert gemäß Auftrag |
