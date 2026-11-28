# CFS Zockt – zentrale Entwicklungsübersicht

Stand: 27.11.2026
Arbeitsbranch: `security/staging-neon-tls-20261125`
Ausgangs-HEAD: `ea54afe05243d6771eae95f726d429fcc2483f07`

## Statuswerte

- **OFFEN** – noch nicht begonnen oder noch nicht ausreichend spezifiziert
- **IN ARBEIT** – aktuell bearbeitet
- **IMPLEMENTIERT** – Quellcode oder Dokumentation ist vorhanden
- **GETESTET** – der relevante lokale Test ist erfolgreich gelaufen
- **BLOCKIERT** – eine externe Abhängigkeit oder eine ausdrücklich nicht erlaubte Ausführung fehlt
- **ABGESCHLOSSEN** – implementiert, getestet, dokumentiert und ohne offene Abnahmebedingung

## Baseline

| Bereich | Status | Tatsächlicher Nachweis / offene Grenze |
|---|---|---|
| Repository und Entwicklungsbranch | GETESTET | Sauberer Checkout auf `security/staging-neon-tls-20261125`, Ausgangs-HEAD `ea54afe` |
| Website-3-Mastercode | IMPLEMENTIERT | `index.html`, `server.js`, `src/`, `pages/`, `migrations/` an der Projektwurzel; alte Archive bleiben Read-only-Referenzen |
| HTML-Seiten | IMPLEMENTIERT | 50 Dateien unter `pages/` plus öffentliche Root-/Widget-/Runtime-Seiten |
| Datenbankmigrationen | IMPLEMENTIERT | 25 SQL-Dateien vorhanden; Produktionsmigrationen und Neon-Umschaltung nicht Bestandteil dieser Entwicklungsarbeit |
| Automatisierte Prüfung | BLOCKIERT | `npm.cmd run check` benötigt die nicht vorhandene lokale Abhängigkeit `node_modules/pg`; keine Neuinstallation ohne separate Freigabe |
| Externe Provider | BLOCKIERT | Twitch, TikTok, PlayStation und Discord-Statistik benötigen echte, nicht im Repository gespeicherte Zugänge bzw. Providerfreigaben |
| Browser-/Screenshot-Abnahme | OFFEN | Referenzbilder und Assets geprüft; laufende Browseransichten müssen im nächsten UI-Paket erneut aufgenommen werden |

## Masterplan nach Funktionsbereich

| Funktionsbereich | Status | Ist-Stand und nächste prüfbare Aufgabe |
|---|---|---|
| Startseite, Über mich, Community, Spiele | IMPLEMENTIERT | Seiten und API-Fallbacks vorhanden; echte Zahlen/Spiele nur aus bestätigten Quellen anzeigen und Browserabnahme ergänzen |
| Login, Registrierung, Recovery | IMPLEMENTIERT | Server- und Frontendpfade vorhanden; Password-Recovery wird in diesem Branch transaktional gegen parallele Tokenverwendung gehärtet |
| E-Mail-Verifizierung | IMPLEMENTIERT | Sichtbarer Status, erneuter Versand, Resend-Fehler, Ablauf und atomare einmalige Tokenverwendung vorhanden; Live-Mail-/DB-Test bleibt abhängig von Stagingzugang |
| Admin-Navigation und Berechtigungen | IMPLEMENTIERT | Adminstatus erfordert übereinstimmende E-Mail, Rolle `admin` und bestätigte E-Mail; Live-DB-Abnahme bleibt separat |
| Creator Dashboard und Creator Suite | IMPLEMENTIERT | Viele Werkzeuge, Projekte und API-Adapter vorhanden; Ende-zu-Ende-Abnahme je Werkzeug noch offen |
| Stream Studio, Widget, Scene, Cut, Audio | IMPLEMENTIERT | Website- und Persistenzpfade vorhanden; Desktop-/OBS-Funktionen werden nicht als Browserfunktion vorgetäuscht |
| Streamdesign-Katalog | IMPLEMENTIERT | 31 Katalogwelten und 16 Varianten referenziert; vorhandene WebPs sind nur Vorschauen, echte animierte Originalmotive fehlen |
| Twitch | IMPLEMENTIERT | OAuth-/öffentliche Pfade vorhanden; echte Providerabnahme BLOCKIERT ohne autorisierte Testkonfiguration |
| TikTok | IMPLEMENTIERT | OAuth-/Statuspfade vorhanden; echte Providerabnahme BLOCKIERT ohne autorisierte Testkonfiguration |
| PlayStation | IMPLEMENTIERT | Katalog-/Launcherpfade und öffentliche Projektion vorhanden; echte Datenquelle und Zuordnung BLOCKIERT |
| Discord | IMPLEMENTIERT | Community-Verlinkung und neutraler Status vorhanden; keine Discord-OAuth-Anmeldung; echte Mitgliederstatistik BLOCKIERT |
| Shop und Zahlungen | BLOCKIERT | Katalog-/PayPal-Vorbereitung vorhanden; kostenpflichtige Käufe bleiben bis Provider-, Rechts- und Abnahmetests gesperrt |
| Datenschutz und Kontowerkzeuge | IMPLEMENTIERT | Sessions, Export, Kontolöschung, MFA-/Passkey-Oberflächen vorhanden; echte Accountabnahme bleibt DB-abhängig |
| Responsive Design und Barrierefreiheit | IN ARBEIT | Gemeinsame CSS-Schichten, Fokus-/Skip-Mechanismen und mobile Regeln vorhanden; 320/375/390/430/768 px sowie Desktop müssen visuell verifiziert werden |
| Persistente Speicherung | IMPLEMENTIERT | PostgreSQL-Projekte, Sessions und Upload-Speicherpfade vorhanden; Storage-/Quota-/Recovery-Abnahme ist noch nicht vollständig live geprüft |
| Backup und Wiederherstellung | ABGESCHLOSSEN | Nachgewiesene unabhängige Neon-Sicherung und isolierte Wiederherstellung sind im Migrations-Runbook dokumentiert; keine erneuten Produktions-Backups in diesem Entwicklungsauftrag |

## Aktuelles Arbeitspaket

1. **Auth-Transaktionshärtung:** die alte doppelte E-Mail-Tokenimplementierung wird aus `src/auth.js` entfernt und nur noch kompatibel auf `src/email-verification.js` verwiesen.
2. **Passwort-Recovery:** Tokenverbrauch, Passwortänderung und Sitzungs-/MFA-Challenge-Invalidierung laufen in einer Transaktion; parallele und abgelaufene Token werden regresstestbar gemacht.
3. Danach: fehlende lokale Abhängigkeit nur nach Freigabe über den vorhandenen separaten npm-Cache herstellen und anschließend die vollständige Testkette inklusive Browser-Smoke-Test ausführen.

## Sicherheits- und Betriebsgrenzen

- Keine produktive Neon-Datenbank, Render-Umgebungsvariable oder Produktionsdeployment wird aus diesem Entwicklungsauftrag verändert.
- TLS bleibt strikt; keine `rejectUnauthorized`-Abschwächung.
- Keine Passwörter, Token, API-Schlüssel, Dumps oder echten Providerdaten in Git, Chat oder Testprotokollen.
- Keine neuen Originaldesigns oder erfundenen Providerstatistiken.
- Rollback erfolgt über den vorherigen lokalen Commit/Branchstand; Datenbankmigrationen und produktive Umschaltungen bleiben separat freigabepflichtig.

## Nächste Arbeitspakete

| Priorität | Paket | Status |
|---|---|---|
| P0 | Auth-/Recovery-Transaktionen und Regressionstests abschließen | IN ARBEIT |
| P0 | Lokale Abhängigkeiten und vollständige `npm`-Testkette nach Freigabe reproduzieren | BLOCKIERT |
| P1 | Gemeinsame UI-Schichten und mobile Abnahme gegen sechs Referenzen | OFFEN |
| P1 | API-/Frontend-Inventar je Seite mit echten Leer-/Fehlerzuständen vervollständigen | OFFEN |
| P1 | Creator-Tools Ende-zu-Ende auf isolierter Testdatenbank prüfen | BLOCKIERT |
| P2 | Provider-Abnahmen für Twitch, TikTok, PlayStation und Discord | BLOCKIERT |
| P2 | Original-Streammotive oder separat freigegebener Kreativauftrag | BLOCKIERT |

## Nachweis dieses Arbeitsschritts

| Paket | Status | Nachweis / Grenze |
|---|---|---|
| Responsive HTML-Vertrag | GETESTET | 59 HTML-Seiten geprüft; jede Seite besitzt `lang` und einen Viewport-Meta-Tag; gemeinsame Breakpoints 980/760/520 px vorhanden |
| Runtime-/Widget-Metadaten | IMPLEMENTIERT | `widgets/stream-maker.html`, `games/runtime.html` und `widgets/scene.html` ergänzt; keine Layout- oder Markenstruktur geändert |
| Visuelle mobile Abnahme | OFFEN | Echte Browser-Screenshots bei 320/375/390/430/768 px fehlen weiterhin, da die lokale Laufzeit-/Abhängigkeitsabnahme nicht vollständig verfügbar ist |

