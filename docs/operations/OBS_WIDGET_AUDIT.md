# OBS-Browserquelle: Bestandsaufnahme und offene Blocker

Stand: 12.11.2026. Codeprüfung, **kein** erfolgreicher Browser-/OBS-Ende-zu-Ende-Test.

## Nachgewiesene Bestandteile
- `widgets/output.html` bindet `/assets/js/cfs-widget-renderer.js`, `/assets/js/cfs-widget-runtime.js` und `/assets/css/widget-runtime.css` ein.
- `assets/js/cfs-widget-renderer.js` unterstützt die Profile `obs`, `tiktok_vertical` und `landscape`; es besitzt Rendering- und Offline-Fallback-Funktionen.
- `src/widget-adapter.js` liefert für veröffentlichte Widgets `/widgets/output.html?widget=<id>`.
- `server.js` enthält authentifizierte CRUD-/Publish-Routen unter `/api/creator/widget-studio/widgets`.

## Kritische offene Punkte
1. Die referenzierten Dateien `assets/js/cfs-widget-runtime.js` und `assets/css/widget-runtime.css` sind auf dem geprüften GitHub-Branch unter diesen Pfaden **nicht vorhanden**. Daher ist die Browserquelle in dieser Form nicht als lauffähig nachgewiesen.
2. Das vorhandene Skript `scripts/check-local-assets.js` prüft `index.html` und `pages/*.html`, aber nicht `widgets/output.html`; die fehlenden Abhängigkeiten fallen dadurch nicht auf.
3. Der Adapter gibt einen relativen Quellpfad aus; vor Freigabe müssen Origin, HTTPS, Cache- und Berechtigungsregeln geprüft werden.
4. Eine veröffentlichte Widget-Konfiguration ist nicht automatisch für anonyme OBS-Browserquellen abrufbar. Es braucht eine **separate, minimal öffentliche** Ausgaberoute mit eindeutiger Zugriffspolitik; private Entwürfe, Kontodaten und Live-Credentials dürfen nicht offengelegt werden.
5. Das bisherige `published_config` wird aus dem jeweils aktuellen `data.config` abgeleitet. Änderungen am Entwurf können deshalb bei einem bereits veröffentlichten Widget sichtbar werden. Entwurf und veröffentlichte Version müssen unabhängig gespeichert werden, bevor wir „Publish“ als sicheren Vorgang bezeichnen.

## Nächster Implementierungs-PR (separat von diesem Architektur-/Test-PR)
- Laufzeitdateien aus dem tatsächlichen gewünschten Datenfluss implementieren, **nicht** durch funktionslose Platzhalter ersetzen.
- Öffentliche Widget-Ausgabe über eine minimale, nur veröffentlichte Daten liefernde API; Eingabevalidierung und XSS-/URL-Policy.
- Persistente Trennung von `draft_config` und `published_config`, mit Rücknahme und Versionskonfliktprüfung.
- Asset-Checker um `widgets/*.html` erweitern und Browserquellen-Ende-zu-Ende-Test ergänzen.
- Nachweis: anonymes veröffentlichtes Widget in OBS sichtbar; unveröffentlichte und fremde Entwürfe nicht abrufbar; Offline-Fallback; kein Leak von Session- oder Anbieter-Tokens.

**Sicherheitsregel:** Bis zu diesem Nachweis nicht als produktionsfertige OBS-Integration bezeichnen und nicht automatisch deployen.
