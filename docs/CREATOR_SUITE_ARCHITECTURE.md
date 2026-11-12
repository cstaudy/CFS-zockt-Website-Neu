# Creator Suite: Architektur und erste Umsetzungsetappe

## Produktentscheidung
Die Creator Suite bleibt primär ein Werkzeug zum **Selber-Erstellen**. Streaming-Integrationen sind Export-/Laufzeitkanäle, kein Ersatz für den Editor.

1. **Widget Studio:** einzelnes Widget erstellen, live vorschauen, versionieren, veröffentlichen.
2. **Universal Builder:** mehrere Widgets zu einem Stream-Layout/Bündel kombinieren.
3. **Launcher:** optionaler Desktop-Bridge-Dienst für OBS, Geräte und autorisierte lokale Live-Quellen.
4. **Cut Studio:** getrennte Clip-/Videobearbeitung, gemeinsame Anmeldung und Projektverwaltung.

## Bereits im Code sichtbar (nicht mit fertig getestet verwechseln)
- `src/widget-adapter.js`: Widget-Registry, Entwürfe, Versionen, Veröffentlichung, OBS-Quellpfad.
- `widgets/output.html`: HTML-Ausgabeseite für Browserquellen.
- `src/universal-builder.js`: Design-Bundles mit Speicherung und Versionskonfliktprüfung.
- `src/launcher.js`: Geräteverknüpfung, Heartbeat, OBS-Status.
- `src/modules.js`: Modulliste; Status `available` ist kein Ende-zu-Ende-Funktionstest.

## Streaming-Vertrag
- **OBS zuerst:** veröffentlichte Widgets über HTTPS-Browserquelle, transparente Darstellung, feste Canvas-Maße und dokumentierte Cache-/Refresh-Regeln.
- **TikTok LIVE:** zunächst vertikale Ausgabe und Nutzung über kompatible Browserquellen/Streaming-Software; direkte Live-Daten und Einbettung nur nach Prüfung tatsächlicher Plattformrechte/API-Zugänge.
- **Ohne Launcher nutzbar:** statische/manuelle Widgets dürfen keine Desktop-Bridge voraussetzen.
- **Mit Launcher erweiterbar:** lokale OBS-Automation und Live-Daten nur über authentifizierte, widerrufbare Geräteverbindungen.

## Sicherheit und Verfügbarkeit: Pflicht vor öffentlichem Rollout
- Bot-Challenge (z. B. Turnstile) **serverseitig** prüfen, adaptiv für Registrierung, Reset und auffällige Login-Versuche; barrierearme Alternative und Failover definieren.
- Rate-Limits je IP **und** Konto/Aktion; Proxy-Header nur aus vertrauenswürdiger Infrastruktur übernehmen.
- Session-Cookies, CSRF-/Origin-Schutz, Berechtigungsprüfungen und MFA mit Negativtests absichern.
- Widget-Konfiguration als untrusted Input behandeln: JSON-Schema, erlaubte Elemente/URLs, XSS-Schutz, Content-Security-Policy und sichere Browserquellen.
- Öffentliche Overlay-URLs nicht als Geheimnis betrachten; private Daten nur über kurzlebige/rotierbare Tokens oder ausdrücklich öffentliche Projektionen.
- Launcher-Bridge-Secret nicht dauerhaft als alleinige geräteübergreifende Identität verwenden; per-device Credentials, Rotation, Replay-Schutz und Widerruf konzipieren.
- Timeouts, Backoff, Heartbeats, degradierte Anzeige bei Provider-Ausfall, Monitoring und Restore-Proben.

## Umsetzung: kleine PRs mit Abnahmetests
### PR A – Inventar und Verträge
- Vorhandene UI-Seiten, API-Routen und Datenflüsse für Widget Studio/Builder/Launcher dokumentieren.
- OBS-Ausgabepfad und öffentliche/geschützte Endpunkte erfassen.
- Unit-Tests für Widget-Schemas und Veröffentlichung ergänzen.

### PR B – Widget-Ausgabe robust machen
- Sichere Render-Pipeline und isolierte Browserquelle.
- Transparenz, feste Größen, Fallback ohne Live-Daten, Reconnect-Tests.
- Nachweis mit lokalem OBS-Browser-Source-Test und Screenshots.

### PR C – Editor und Projekte
- Speichern/Laden/Versionieren, Vorschau, Veröffentlichung und Rücknahme testen.
- Einheitliche Projekt-ID und Eigentümerprüfung; keine stillen Formatmigrationen.

### PR D – TikTok-kompatible Ausgabe
- Vertikale Profile, Browser-Source-Verifikation, unterstützte Live-Datenquellen separat kennzeichnen.
- Keine unbestätigte Aussage über offizielle TikTok-LIVE-API oder direkte Integration.

### PR E – Launcher und Universal Builder
- Geräteauthentifizierung härten, OBS-Automation optional machen.
- Bundle-Komposition und Widget-Referenzen mit Kompatibilitätstests.

## Definition of Done für jedes Feature
- Benutzer kann erstellen, speichern, neu öffnen, bearbeiten, veröffentlichen und zurückziehen.
- Eigentümer- und Zugriffsschutz sowie Eingabevalidierung sind getestet.
- Fehlerfall (Datenquelle offline) bleibt sichtbar und beeinträchtigt andere Widgets nicht.
- CI grün, Staging-Ende-zu-Ende-Test dokumentiert, Rollback möglich.
- Keine produktive Datenbankmigration ohne vorherigen echten, verifizierten isolierten Restore und ausdrückliche Freigabe.
