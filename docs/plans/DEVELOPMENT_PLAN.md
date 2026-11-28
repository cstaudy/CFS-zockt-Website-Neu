# CFS Zockt – zentraler Entwicklungsplan

Stand: 28.11.2026. Master: `CFS-zockt-Website-Neu` (Website 3), geprüfter main-Stand `7808447`. Dieser Plan ersetzt die allgemeine Prioritätenliste vom 14.11.2026; datierte Fachpläne und Auditberichte bleiben historische Nachweise. Die öffentliche [Roadmap](../../pages/roadmap.html) ist die vereinfachte Produktübersicht, keine technische Freigabe.

## 1. Verbindliche Leitplanken

- Ausschließlich Website 3 weiterentwickeln. Ältere Website-Repositories und Launcher-Quellen nur selektiv als Referenz nutzen; keine zweite Website, kein blindes Überschreiben, keine doppelte Account-, Medien-, Job- oder Editorverwaltung.
- Betreiberentscheidung vom 28.11.: **Neon ist die neue zentrale Datenquelle.** Das aktive Zielprojekt ist `cfs-zockt-render-migration`; den tatsächlich verwendeten Laufzeitanschluss separat ohne Offenlegung von Zugangsdaten verifizieren.
- Render bleibt bis zur bestätigten Betriebsentscheidung unverändert. Keine Migration, DB-Umschaltung, Löschung, neue Kosten, App-Freigabe, Veröffentlichung oder Deploy ohne gesonderte Freigabe und passende Abnahme.
- Bestehende URLs, Account-IDs, OAuth-Verbindungen, Projekt-/Medienreferenzen, MFA und Zugriffsgrenzen erhalten. Keine Secrets, personenbezogenen Daten oder Roh-Tokens in GitHub, Logs oder öffentliche Roadmap.
- Kleine isolierte PRs, gezielte Regressionstests und grüne CI; reale Provider-/Geräteabnahme separat. Nicht freigegebene Funktionen mit „geplant“, „Code vorhanden“ oder „Abnahme offen“ kennzeichnen.

## 2. Status und Nachweise

| Bereich | Status am 28.11.2026 | Abnahmelücke |
|---|---|---|
| Website 3 main | GitHub Website checks [erfolgreich](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45023206525), 22.11. | Keine Produktionsfreigabe aus CI ableiten |
| Neon als Ziel | Betreiberentscheidung; Neon PostgreSQL 18.7 lesend erreichbar; ältere Projekte archiviert | Tatsächliche Render-Laufzeitverbindung nicht unabhängig bestätigt |
| Neon-Sicherung | Manueller Snapshot vom 24.11. vorhanden (Ablauf 24.12.2026); separater wiederhergestellter Branch und Backup-Restore-Datenbank vom 26.11. lesbar | Dauerhafte unabhängige verschlüsselte Kopie, Schlüsselverwahrung und vollständiger Restore-Nachweis noch nicht belegt |
| Restore-Struktur | Read-only Vergleich Produktion/Restore: jeweils 26 Tabellen, 59 Indizes, 229 Constraints; ausgewählte aggregierte Bestandswerte überwiegend gleich, Sessions abweichend | Keine vollständige Inhalts-/Berechtigungsprüfung; keine vollständige Gleichheit behaupten |
| Neon Staging | Separater Staging-Branch; Migrationsledger mit 25 Einträgen; zusätzliche Validierungsbranches vorhanden | Produktionsbranch ohne Ledger, Staging nicht schemaidentisch; Anwendungstests und Isolation nachweisen |
| Backup-Automatik | Kein automatischer Snapshot-Zeitplan beim Check; Produktionsbranch nicht geschützt | Verfügbarkeit/Tarif und Berechtigungen prüfen; Betreiberentscheidung zu Zeitplan, Branch-Schutz und externer Sicherung |
| Benutzerkonten/MFA | Kern, Tests und historische Sicherheits-PRs vorhanden | Aktuelle Varianten konsolidieren; Betreiberzugang und Recovery abnehmen |
| Creator / Medien | Projekt-, Medien-, Quota-, Upload- und Cut-Export-Code vorhanden | Reale Persistenz und Export-Lifecycle; Uploads derzeit 16 MiB gepuffert |
| TikTok/Twitch | OAuth-Code und verschlüsselte Token-Speicherung vorhanden | Echte Konfiguration/Scopes, Refresh/Widerruf und Provider-Abnahme |
| Multistream | UI und Konfigurationsspeicherung vorhanden; Master-Backend meldet aktuell ein Ziel | Live-Bridge/Engine aus älterem Main gezielt vergleichen und integrieren; reale Mehrziel-Tests |
| Multi-Publisher | Noch nicht implementiert | API-Freigaben, Aufbereitung, Aufträge, Status, sichere Veröffentlichung |
| Commerce | Getrennter späterer Block | Keine Aktivierung vor eigener rechtlicher/technischer Abnahme |

Neon-Leseprüfung erfolgte ohne SQL-Schreiboperationen und ohne Konfigurationsänderung. [Historischer Master-Audit #100](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/100) und [Render→Neon-Kopie vom 22.11.](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45014794902) sind ergänzende Nachweise, nicht der aktuelle Laufzeitbeweis. Die alte dokumentierte Render-Frist 09.12.2026 bleibt als historische Betriebswarnung zu prüfen, bis der Cutover bestätigt ist.

## 3. Priorisierte Arbeitspakete

| ID | Priorität / Paket | Status | Abnahme / Abhängigkeit |
|---|---|---|---|
| DB-01 | P0: Neon-Laufzeitzuordnung und Render-Cutover verifizieren | Teilweise bestätigt | Redigierter Laufzeitnachweis der tatsächlichen DB-Identität, öffentliche Health/Ready und authentifizierter Smoke-Test; keine URL/Secrets in Berichten |
| DB-02 | P0: Backup/Restore und Aufbewahrung | Teilnachweis | Snapshot vor Ablauf erneuern oder dauerhaft sichern; unabhängige verschlüsselte Kopie, Wiederherstellung isoliert, Schema-/Daten-/Berechtigungscheck, RPO/RTO und Rollback dokumentieren; Tarif/Branchschutz prüfen |
| DB-03 | P0: Migrationsstand vereinheitlichen | Offen | Bestehende 001–025 gegen tatsächliches Schema prüfen, Baseline/Upgrade nur isoliert testen; Migrationen 026/027 und konkurrierende Entwürfe erst nach Inventar/Review nummerieren; kein produktiver Eingriff ohne Freigabe |
| SEC-01 | P0: Offene Sicherheits-PRs konsolidieren | In Arbeit | #103 Recovery, #47/#52 Admin, #33–#43 MFA, ältere #26 prüfen; kein Blindmerge, Lockout-/Rollback-Test |
| UI-01 | P1: CFS Identity und responsive Basis | Entwurf | #101 mit #11/#12 abgleichen; vorhandene Designreferenzen und Freigaben nutzen; keine parallele Shell |
| CUT-01 | P1: Cut Studio und Mobile Gaming Edition | Entwurf #106 | Bestehende Timeline/Export/Projektlogik erhalten; iPhone-Safari MP4/Audio/FPS/Ausschnitt und Windows-Export abnehmen |
| CORE-01 | P1: Gemeinsame Provider- und Job-Grundlage | Teilweise vorhanden | #50 aufteilen; Account-/Geräte-Isolation, Token-Erneuerung/Widerruf, getrennte Fähigkeiten read/live/publish, sichere Job-Zustände und Abnahme |
| LIVE-01 | P1: Multistream vervollständigen | Teilweise vorhanden | Versionierte Speicherung beibehalten; Mehrziel-Limits serverseitig prüfen; selektiver Launcher-Port, getrennte Ausgänge, Reconnect, Soak, OBS und echte Provider-Tests |
| PUB-01 | P1: Entwickler-Apps und Publishing-Verträge | Geplant | TikTok/Google/Meta-Anträge und Testaccounts; Rechte pro Ziel; kein Anspruch auf Freigabe; parallel zu DB-Arbeiten ohne Produktionszugriff möglich |
| PUB-02 | P2: Medienaufbereitung und Übergabe | Geplant | Aus Cut Studio oder Mediathek, Formate 9:16/16:9/1:1/4:5 nach Plattform, Untertitel/Schriften/Branding, Titel/Beschreibung/Hashtags, Vorschau und Validierung |
| PUB-03 | P2: Multi-Publisher und Upload Manager | Geplant | Zentraler Auftrag mit Zielaufträgen, explizite Freigabe, Fortschritt, Statusabfrage, Idempotenz, Fehlerisolation und Wiederholung nur fehlgeschlagener Ziele |
| PUB-04 | P2: Planner und zeitgesteuerte Veröffentlichung | Geplant | Erst nach PUB-03; Zeitzone, persistente Queue, Wiederanlauf, sichere temporäre Medien, Ablauf/Löschung; Upload bei ausgeschaltetem PC nur mit freigegebener serverseitiger Infrastruktur |
| REL-01 | P3: Plattform- und Produktabnahme | Offen | Staging E2E, reale OAuth-/Publisher-Tests, Datenschutz, App-Review, Benutzerfreigabe, Deployment-/Rollback-Entscheidung |
| COM-01 | P4: Commerce | Getrennt / zurückgestellt | Checkout, Steuern, Rechnungen, Refunds, Entitlements separat freigeben |

## 4. Multi-Publisher – Architektur und Grenzen

Ziel: Ein Video einmal erstellen, bestehende Medienreferenz oder Export übernehmen, plattformgerechte Varianten vorbereiten, verbundene Accounts auswählen, je Ziel Vorschau und Einstellungen bestätigen und eine gemeinsame Veröffentlichung anstoßen. Ein Klick startet mehrere unabhängige Upload-Aufträge; eine exakt gleichzeitige externe Veröffentlichung ist nicht garantiert.

| Vorhandenes Modul | Entscheidung |
|---|---|
| `src/auth.js`, `pages/integrations.html`, `assets/js/page-integrations.js` | Bestehende Anmeldung und Account-Verwaltung erweitern; keine zweite Authentifizierung |
| `src/tiktok.js`, `src/twitch.js`, OAuth-States und Connection-Tabellen | Vorhandene Verbindungen erhalten, Capability-Modell und sicherer Token-Lifecycle ergänzen; Mehrkonten-Schema erst nach Migrationsreview |
| `src/user-media.js`, `src/media-quota.js`, `src/upload-media-policy.js`, `src/upload-write.js` | Bestehende Mediathek und Sicherheitsregeln nutzen; fortsetzbare/streamende Uploads und temporäre Speicherung separat entwerfen, nicht bloß 16-MiB-Grenze erhöhen |
| `src/cut-project-save.js`, `pages/cut-studio.html`, `assets/js/cut-studio.js` | Export-Übergabe per stabiler Medien-/Projekt-ID; keine zweite Timeline; #106 beachten |
| `src/tool-jobs.js`, `src/launcher.js`, `src/launcher-auth.js` | Bestehende Sicherheits- und Lifecycle-Verträge wiederverwenden; Cut-Jobs nicht pauschal für Publishing öffnen; eigene Zielzustände und Ownership/Lease/Retry-Verträge definieren |
| `src/stream-studio-state.js`, `assets/js/stream-studio.js` | Bestehende versionierte Studio-Speicherung erhalten; LIVE- und Publishing-Fähigkeiten getrennt, gemeinsame Provider-Verwaltung |
| Älteres `cfs-zockt-Website-main/launcher/src/stream-engine.js`, Cut-Media-Engine und Tests | Nur spezifisch fehlende Funktionen nach Kompatibilitäts-/Lizenz-/Sicherheitsprüfung portieren |

### Plattformen und Entwicklerstatus

| Ziel | Code / Anforderung | MVP |
|---|---|---|
| TikTok | Bestehende OAuth-Scopes `user.info.basic,video.list`; `video.publish` für Direct Post bzw. `video.upload` für Upload-to-inbox, App-Review/Audit und erforderliche Zustimmung | Nach bestätigter Freigabe; keine private-only Tests als öffentliche Freigabe ausgeben |
| YouTube / Shorts | Google OAuth, YouTube Data API v3, `youtube.upload`, ggf. Verifizierung/API-Audit; Shorts-Klassifizierung nach YouTube-Regeln | Nach Test-/Projektfreigabe |
| Instagram / Facebook | Meta Developer App, geeignete professionelle Konten/Seiten, Publishing-Scopes je gewähltem Login-Produkt, App Review | Nach Test-/App-Freigabe |
| Twitch / Kick | LIVE-Fähigkeiten getrennt von Veröffentlichung; kein bestätigter allgemeiner Video-Datei-Upload in Master | Kein Direktupload versprechen; Export/weiterführender manueller Workflow, sofern API fehlt |

Offizielle Referenzen: [TikTok Content Posting API](https://developers.tiktok.com/products/content-posting-api/), [Google YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [Meta Instagram Platform](https://developers.facebook.com/docs/instagram-platform/), [Meta Video API](https://developers.facebook.com/docs/video-api/). Anforderungen zum Zeitpunkt der Implementierung erneut verifizieren. Externe Entwickler-App-Freigaben wurden nicht unabhängig eingesehen.

### Nichtfunktionale Anforderungen

- Benutzerfreigabe je Plattform, Privacy-/Interaktions-/Werbeoptionen nach Provider-Regeln; keine automatischen Veröffentlichungen ohne Zustimmung. Nur eigene/berechtigte Inhalte; Datenschutz, Lösch- und Widerrufsfunktion.
- Serverseitige Besitz-/Scope-Prüfung, OAuth State/PKCE soweit unterstützt, sichere Token-Verwaltung und Rotation, keine Tokens im Browser/Logs; Rate Limits, Missbrauchsschutz und Audit ohne sensible Inhalte.
- Idempotente Zieljobs; bei unklarem Provider-Ergebnis zuerst Status abfragen statt doppelt posten; Fehler einzelner Plattformen blockieren andere nicht. Wiederaufnahme, Cancel und externe Post-ID je Ziel.
- Lokal rendern, wenn möglich; externe Speicherung/Worker erst mit genehmigtem Budget und Sicherheitskonzept. Keine KI-/Cloud-Kosten ohne Freigabe.
- Tests: Mock-Provider, OAuth-Negativfälle, Cross-Account-Isolation, Scope-/Quota-/Upload-Grenzen, Retry/Duplicate/Crash-Recovery, Format-/Untertitelprüfung, iPhone/Windows, reale Sandbox-/Testaccounts und jeweils nachvollziehbare Abnahme.

## 5. Überschneidungen und Integrationsreihenfolge

19 offene PRs zum Prüfzeitpunkt. #100/#105 liefern Audit und Integrationsreihenfolge; #50 enthält große Creator-/Launcher-/Twitch-Änderungen samt Migrationsentwürfen; #106 betrifft direkt den Cut-Workflow; #101 betrifft das Design. Keine parallele Implementierung dieser Bereiche. Bestehende Branches zuerst gegen aktuellen main vergleichen, Überschneidungen dokumentieren, in kleine PRs aufteilen und nur passende Teilfunktionen übernehmen. #103 bleibt der bestehende Recovery-PR; kein zweiter Recovery-PR.

Nächster ausführbarer Schritt: **DB-01/DB-02 lesend verifizieren und PUB-01/CORE-01 als Schnittstellen- und Testentwurf vorbereiten**, anschließend kleine Implementierungs-PRs. Kein Produktivdeploy aus diesem Plan. Aktualisierungen: Status, Datum, Commit/PR, Testnachweis, offene Grenzen und Rollback im selben PR pflegen; die öffentliche Roadmap gleichzeitig auf zutreffende Produktstatus aktualisieren. Historische Pläne nicht löschen.

## 6. Arbeitsfortschritt 28.11.2026 – DB-01 / DB-03

- [PR #108](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/108): neuer optionaler, rein lesender Zielkonfigurationsabgleich im bestehenden Release-Preflight; 18 lokale isolierte Tests erfolgreich, vollständige CI und Betreiber-Laufzeitabnahme offen. Keine zweite Preflight-Infrastruktur, kein produktiver Eingriff.
- Neon-Schemadiffs: production fehlt MFA 022–025 und Ledger; Restore-/Clean-Validation-Branches zeigen ACL-Abweichungen der Backup-Leserolle, Staging zusätzlich MFA-/Ledger-Änderungen. Vollständige Restore-/Rechteabnahme bleibt offen.
- Kollision: PR #50 und #103 verwenden beide Migrationsnummer 026 für unterschiedliche Funktionen. Vor Integration aktuelle Migrationen und deren Abhängigkeiten konsolidieren, keine produktive Migration oder historische Checksum ändern.
- GitHub-CI: #107 [erfolgreich vor diesem Fortschrittsupdate](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46095661194), #103 [erfolgreich](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45181003166), #106 [erfolgreich](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/45354383750); reale Recovery-/iPhone-Abnahme offen. #50 bleibt konfliktbehaftet.
- DB-01 bleibt teilweise bestätigt: öffentliche Status-API nicht abrufbar, Render-Workspace noch nicht ausdrücklich ausgewählt. Kein Beweis der tatsächlich verwendeten Produktionsverbindung. TLS-Treiberkonfiguration getrennt prüfen. DB-02 bleibt Teilnachweis, DB-03 bleibt offen.

## 7. Weiterer Arbeitsfortschritt – Render-Laufzeitabgleich und TLS

- Render-Workspace vom Betreiber zur lesenden Prüfung freigegeben. Produktion und Staging sind getrennte, aktive Dienste desselben Master-Repositorys, beide mit deaktiviertem Auto-Deploy.
- Produktion: aktiver Deploy 27.11.2026, 20:13 UTC, Commit `6f51092`, Branch `security/production-neon-tls-20261125`; Startlogs melden 001–021. Staging: aktiver Deploy 26.11.2026, 16:28 UTC, Commit `ea54afe`, Branch `security/staging-neon-tls-20261125`; Startlogs melden bereits bekannte Migrationen 001–025. Branchvergleich: Produktion 17 voraus/136 zurück, Staging 12 voraus/42 zurück gegenüber main. Keine pauschale Zusammenführung oder Branch-Umschaltung.
- TLS-Absicherung und dazugehörige pg-Client-Tests bereits in beiden Bereitstellungsbranches vorhanden; selektiv in bestehenden [PR #108](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/108) portiert, ohne den normalen Server oder die Migrationslogik zu ersetzen. Die bestehende CI-Suite führt die übernommenen Tests aus; neuer HEAD benötigt erneute Prüfung. Frühere CI für #108 [grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46095906852), #107 [grün vor diesem Update](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46095926129).
- DB-01: Render-Dienst/Revision und TLS-Code bestätigt, tatsächliche Datenbankidentität und TLS-Handshake nicht. Die Health-/Ready-URLs waren nicht abrufbar; weder Secrets noch Einstellungen wurden ausgelesen oder geändert. DB-02/DB-03 bleiben teilweise belegt/offen.
- Nächste Integration: GitHub-CI für die TLS-Übernahme, redigierter Laufzeitnachweis, bestehende Sicherheits-/Migrationsentwürfe anhand der 026-Kollision konsolidieren; danach CORE-01/PUB-01. Kein Merge oder Deploy in diesem Schritt.
