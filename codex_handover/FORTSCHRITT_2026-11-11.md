# Weiterentwicklung nach dem ersten Website-3-Stand

## Geprüfte Ansichten und Befunde
Die sechs Referenzbilder wurden gegen echte lokale Seitenansichten geprüft. Die Screenshots liegen unter `codex_handover/screenshots/`. Die Ansicht von Dashboard, Account und Admin zeigt ohne Sitzung den Login; das ist die bestehende Zugriffssperre und kein Screenshot der geschützten Inhalte. Für diese drei Bereiche bleibt die visuelle Abnahme mit Testkonto offen.

| Bereich | Ergebnis |
|---|---|
| Startseite | Desktop und echte 390-px-Emulation aufgenommen. Hero, About-Karte und mobile Navigation geprüft. |
| Anmeldung | Bestehende Login- und Registrierungsformulare in einen tabbed Einstieg gebracht; beide bleiben im selben DOM und sind per Hash erreichbar. |
| Creator Suite | Desktop und Mobil aufgenommen; bestehende Werkzeuglinks erhalten. Deutliche Abweichung von der Sidebar-Vorlage bleibt offen. |
| Dashboard, Account, Admin | Ohne Konto zum Login umgeleitet; geschützte Oberfläche nicht visuell abgenommen. |

Der in `brand/cfs-site-background-r110.webp` gelieferte Hintergrund ist geometrisch und zeigt **keine** Berg-/See-Landschaft wie die sechs Mockups. Das Projekt enthält keinen nachgewiesenen freistehenden Berg-/See-Hintergrund ohne eingebrannte UI. Deshalb wird aus den Mockups kein Hintergrund herausgeschnitten.

## Änderungen und Nachweise
- Login- und Registrierungsansicht verwenden zwei zugängliche Tabs mit Pfeiltasten, `aria-selected` und Hash-Auswahl (`#regForm`); beide bestehenden Formulare und MFA-Elemente blieben erhalten. Browser-Interaktion: PASS.
- Mobilregeln für Startseite, Login und Creator Suite angepasst. Bei 390 px meldet der Browser für alle drei Seiten `content:390` und `viewport:390`. Mobiles Startseitenmenü öffnet nach Klick: PASS.
- Eine doppelte, unerreichbare `GET /api/admin/store/checkout-readiness`-Route aus `server.js` entfernt. Die verbleibende Route antwortet ohne Sitzung mit HTTP 401; auch `/api/admin/control-center/summary` mit 401. Keine DB- oder API-Vertragsänderung.
- Twitch-Fallback in `src/public-twitch.js` meldet ohne bestätigte Providerantwort `status: unknown` und `viewer_count: null` statt unbelegt „offline“ und 0 Zuschauer. Direkter Modultest ohne Credentials: PASS.
- `npm run check`, `node --check` der neuen JS-Dateien und `scripts/check-local-assets.js`: PASS; 51 HTML-Seiten, 0 fehlende lokale Assets.
- `/api/ready`: HTTP 503 ohne Datenbank, erwarteter BLOCKED-Zustand. OAuth, Zahlungen, OBS und geschützte Nutzerflows bleiben ohne Testumgebung ungetestet.

## Nächste Abnahme
Ein nichtproduktives Testkonto und eine nichtproduktive DB sind nötig, um Dashboard, Account, Admin, MFA, Projekte und Rollenaktionen zu prüfen. Für die Berg-/See-Optik wird ein freistehendes freigegebenes Asset benötigt. Die sechs Mockups belegen die Designrichtung, enthalten aber eingebrannte UI und Demo-Daten.
