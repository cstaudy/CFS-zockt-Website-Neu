# Technische Fertigstellung vor der Gesamtabnahme

Stand: 13.11.2026. **Arbeitsliste, keine Freigabe oder Behauptung vollständiger Funktion.**
Ziel: Jede tatsächlich angebotene Funktion vom UI bis zur Datenhaltung, Autorisierung und Ausgabe vollständig verbinden. Abschließende Abnahme erst nach technischer Fertigstellung. Sicherheitsprüfungen und Entwickler-Checks bleiben während der Umsetzung erforderlich.

## Fertig-Kriterium für jede Funktion
- Einstiegspunkt und Navigation vorhanden; Mobil-/Desktop-Zustände, Lade-/Leer-/Fehlerzustände definiert.
- UI-Aktion erreicht einen realen API-Handler; kein Schein-Erfolg und keine Demo-Daten als echte Daten.
- Server validiert Eingaben, verlangt die passende Rolle und isoliert Daten nach `account_id`; Änderungen sind CSRF-/Origin-geschützt.
- Speicherung, erneutes Öffnen, Aktualisieren und gegebenenfalls Löschen/Archivieren funktionieren nachvollziehbar.
- Keine Zugangsdaten, internen Felder oder Entwürfe in öffentlichen Antworten; Uploads und externe URLs werden gesondert geprüft.
- Datenbankschema, Migration, Backups und Restore-Pfad dokumentiert; keine produktive Migration ohne gesicherte Freigabe.
- Zustände bei fehlender Konfiguration, Offline-Verbindung, Fehlern und Berechtigungsentzug sind ehrlich und benutzbar.
- Technische Entwicklerprüfungen ergänzt; abschließende Nutzer-/OBS-/Provider-Abnahme bleibt separater letzter Schritt.

## Arbeitsbereiche und Abhängigkeiten

| Bereich | Zu vervollständigen | Derzeitige Einordnung |
| --- | --- | --- |
| Öffentliche Startseite | Navigation, Links, öffentliche API-Daten, Datenschutz, SEO, Mobilansicht, Kontakt-/Rechtstexte | Vorhanden; vollständige Durchsicht offen |
| Anmeldung / Registrierung | Passwortregeln, E-Mail-Verifikation, Login-Drosselung, Session-Cookies, Logout, Passwort-Reset, MFA, Wiederherstellung | Code und einzelne Entwicklerprüfungen vorhanden; vollständige Zugriffskette offen |
| Kontoschutz | CSRF/Origin, Security-Header, Rate Limits, Fehlercodes, Session-Invalidierung, Audit-Ereignisse | Teilweise implementiert; systematische Endpoint-Prüfung offen |
| Dashboard | Nur eigene Daten, leere Konten, Status- und Readiness-Anzeigen, Navigation | Vorhanden; UI-API- und Rollenprüfung offen |
| Creator Suite / Meine Tools | Tool-Liste, Berechtigungen, Planlimits, persistente Projekte, Archivierung | Vorhanden; Konsistenz und Rechteprüfung offen |
| Widget Studio | Erstellen, Bearbeiten, Entwurf, Versionierung, Veröffentlichen, öffentliche OBS-Ausgabe | Implementierung im Draft-PR im Aufbau; noch nicht abgenommen |
| Scene Studio / Stream Studio | Szenen speichern, Widget-Referenzen, Launcher-/OBS-Status, sichere Ausgabe | Vorhanden; vollständige Datenflussprüfung offen |
| Medien / Uploads | Dateityp, Größe, Besitz, Veröffentlichung, Löschung, persistente Speicherung | Teilweise geprüft; öffentliches Asset-Rechtemodell weiter prüfen |
| Universal Builder / weitere Studios | Alle sichtbaren Editoraktionen, Speichern, Wiederverwenden, Export, Berechtigungen | Bestand und technische Lücken je Tool erfassen |
| TikTok / Twitch / LIVE | OAuth, Token-Schutz, Trennung Demo/Offline/Live, Provider-Berechtigungen | Externe Freigaben und reale Provider-Abnahme ausstehend |
| Launcher / Desktop / OBS | Gerätebindung, Tokenrotation, Status, Browserquelle, sichere Fehlerzustände | Kein bestätigter End-to-End-Nachweis |
| Einstellungen / Abrechnung | Tatsächliche Speicherung, Kontosicherheit, Plananzeige, keine unfreigegebenen Käufe | Providerabhängige Funktionen bewusst gesperrt |
| Betrieb / Datenbank | Migrationen, Secrets, Monitoring, Logs, Backup/Restore, Staging/Release | Produktions-Backup/Restore nicht nachgewiesen; kein Prod-Eingriff |

## Umsetzungsreihenfolge
1. Querschnittsschutz: Authentifizierung, Session, CSRF, Eigentümerprüfung, öffentliche/private API-Grenzen.
2. Konto und Dashboard: Registrierung, Anmeldung, Sicherheit, Profil und Datenzustände.
3. Creator Suite und Projekt-Lifecycle: Übersicht, Entwurf, Persistenz, Limits, Wiederöffnen.
4. Studios und Medien: Widget, Scene, Stream, Universal Builder, Cut, Audio und Exportwege.
5. Integrationen und Desktop/OBS: Nur tatsächlich verfügbare Fähigkeiten freigeben.
6. Öffentliche Startseite und Gesamt-Navigation: Inhalt, Links, Datenschutz, Mobile.
7. Technische Stabilisierung: Migrationen, Betriebsführung, Entwickler-Checks, offene Blocker.
8. **Zum Schluss** gemeinsame Abnahmetests mit echten Nutzerabläufen und getrennten OBS-/Provider-Szenarien.

## Release-Grenzen
Dieser Draft-PR ist keine Produktfreigabe. Kein Merge, kein Produktionsdeploy, keine produktive Datenbankmigration, kein Live-Provider-Zugriff und keine Kostenaktivierung ohne separate Freigabe. Extern nicht verfügbare Funktionen erhalten einen transparenten gesperrten Zustand statt einer vorgetäuschten Integration.
