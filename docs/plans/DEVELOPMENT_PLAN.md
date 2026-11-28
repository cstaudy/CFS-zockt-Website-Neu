# CFS Zockt – zentraler Entwicklungsplan

Stand: 28.11.2026. Master: `CFS-zockt-Website-Neu` (Website 3), geprüfter main-Stand `7808447`. Dieser Plan ersetzt die allgemeine Prioritätenliste vom 14.11.2026; datierte Fachpläne und Auditberichte bleiben historische Nachweise. Die öffentliche [Roadmap](../../pages/roadmap.html) ist die vereinfachte Produktübersicht, keine technische Freigabe.

**Aktuelle Priorität:** Multi-Publisher-Ausbau vorerst pausiert. Zuerst den [technischen Gesamtstand und die Codex-Integrationsreihenfolge](WEBSITE3_TECHNICAL_INVENTORY.md) abarbeiten (Betrieb/Sicherheit, Launcher, Creator-Kern, Streaming, Cut, öffentliche Datenquellen und Design). Die späteren Publishing-Pakete bleiben erhalten.

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

## 8. Arbeitsfortschritt – Migrationskonsolidierung und Sicherheitsguard

- [PR #108](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/108): TLS-Übernahme samt Ziel-Preflight hat die vollständige [Website-CI am geprüften HEAD](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46096175380) erfolgreich bestanden. Laufzeitabnahme weiterhin separat.
- Read-only Neon-Ledger-/Schemaabgleich: production und clean-validation ohne Ledger; staging 001–025; recovery-validation 001–026 inklusive `026_password_recovery_rate_limit.sql`. Launcher-Claim und Twitch-Follow-Schema fehlen in den vier geprüften Datenbanken.
- Reihenfolge: #103 behält 026 (bereits isoliert ausgeführt); #50 nach vollständigem Zielinventar thematisch aufteilen, Launcher-Claim als 027 und Twitch EventSub als 028 vorbereiten. 001–025 unverändert; keine bereits ausgeführte Datei umbenennen; Abhängigkeiten, Tests, Release-Schemaflags und Dokumentation konsistent halten. Keine dieser neuen Zuordnungen ist ausgeführt.
- [PR #109](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/109): Migrationsrunner und Baseline verweigern doppelte Präfixe, Lücken und ungültige Namen vor SQL-Zugriff. 11 Negativfälle und gültige Präfixe im bestehenden Testskript; CI offen. Migrations-README korrigiert (automatische Start-Baseline ist verboten). #103/#50 teilen Testdatei: gezielte Testkonsolidierung beim Merge.
- DB-03/SEC-01: technische Sicherung vorbereitet; Produktionsbaseline, Rechte-/Restore-Abnahme und Admin-PR-Konflikte bleiben offen. #103 CI grün, #47/#52 und #50 konfliktbehaftet. Keine produktive Migration oder Änderung an Neon/Render. Nächster Schritt: CI #109 und #107, isolierte Konsolidierung der Security-Entwürfe und gemeinsame Provider-Capabilities (CORE-01), ohne bestehenden OAuth- oder Cut-Workflow zu duplizieren.

## 9. Arbeitsfortschritt – gemeinsame Plattformfähigkeiten

- #109 Migrationsmanifest-Schutz: [vollständige Website-CI erfolgreich](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46096402175). Produktionsbaseline und Freigaben bleiben offen.
- CORE-01: [PR #110](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/110) ergänzt die bestehende authentifizierte Integration-API und das vorhandene Integrations-Hub um sieben Plattformen (TikTok, Twitch, YouTube, Instagram, Facebook, Kick, Custom RTMP). Gespeicherte Konto-/Scope-/Ablaufmetadaten, Live- und Publishing-Status sind getrennt; keine Tokens oder Profil-IDs ausgegeben. Alle neuen Ready-Flags bleiben false. Fehlerstatus unavailable. Keine neuen Tabellen, kein Upload oder Provider-Aufruf.
- Neue Capability- und Vertragsprüfungen im vorhandenen Provider-Testlauf. CI und reale HTTP-/Browser-/Provider-Abnahme für #110 ausstehend. #50/#103 berühren server.js; #50 zusätzlich die Integrationsseite und JS. Selektiver Abgleich erforderlich; keine konkurrierende OAuth-Implementierung.
- Nächster Block: CI #110, bestehende Provider-/Token-Lifecycle-Entwürfe und offizielle Entwicklerfreigaben (PUB-01) prüfen, gemeinsame Ziel-/Job-Verträge für Multistream und Multi-Publisher vorbereiten. DB-01/02/03 und SEC-01 behalten ihre eigenen Produktionsfreigabegrenzen. Kein Merge, Deploy, produktives SQL, Tarifwechsel oder externe Veröffentlichung.

## 10. Arbeitsfortschritt – Multi-Publisher-Vorschau

- [PR #111](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/111) baut ausdrücklich auf #110 auf (Folge-PR gegen dessen Branch). Bestehender Integrations-Hub und Mediathek um unverbindliche Vorschau erweitert: eigene Videos/Clips, fünf Zielprofile, Titel/Beschreibung, gewünschte Untertitel/Branding; serverseitige Eigentümer-/Eingabeprüfung und Blocker pro Ziel. Kein Rendering, Auftrag, Upload, Scheduling oder externe Veröffentlichung. Keine Migration.
- Offizielle Entwickler-Dokumentation zu TikTok Direct Post/Inbox, Creator Info und Zustimmung, YouTube OAuth/videos.insert/fortsetzbarem Upload sowie Meta App Review dokumentiert. Aktuelle YouTube-Dokumentation beschreibt keine generelle Private-only-Pflicht mehr; konkrete Projektfreigabe prüfen. Keine tatsächlichen externen App-Freigaben bestätigt.
- Token-Lifecycle: vorhandene Refresh-Token-Speicherung, aber kein vollständiger Refresh-/Widerrufspfad im Master nachgewiesen. #50 enthält Twitch EventSub-Widerruf, keine zweite OAuth-Implementierung erstellen. Atomare Rotation, Disconnect-Rennen und sichere Wiederholungen separat vorbereiten.
- Tests in bestehende Provider-Suite eingebunden; CI und echte Browser-/HTTP-Abnahme für #111 noch offen. #110 zuerst integrieren, dann #111 auf aktuellen main umstellen. #50/#103-Überschneidungen bleiben zu konsolidieren; #106 und Cut-Export-Queue unberührt. Nächster Block: Token-Lifecycle und getrennte Publishing-Job-Verträge; DB-/Release-Gates bleiben bestehen. Kein Merge, Deploy, Tarifwechsel oder produktives SQL.

## 11. Arbeitsfortschritt – TikTok Token-Lifecycle und Entwicklerfreigaben

- #110 gemeinsame Plattformfähigkeiten: [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46096609067). #107 [vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46096864574). #111 Multi-Publisher-Vorschau bleibt der bestehende Folge-PR; keine parallele Vorschau erstellt.
- [PR #112](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/112): bestehender authentifizierter TikTok-Profil-Sync erhält accountgebundene Token-Rotation mit Zeilenlock, begrenztem Timeout, verschlüsselter Speicherung, tatsächlichen Laufzeiten und Identitätsprüfung. Callback nutzt korrekt `refresh_expires_in`. Keine neuen Scopes, Tabellen, Hintergrundjobs, Provider-Publishing oder Änderung des öffentlichen Feeds.
- Neue Mock-Tests im vorhandenen Provider-Testskript; CI und echte PostgreSQL-Parallelitäts-/Provider-Abnahme offen. #110/#111 teilen Provider-Testskript, Imports bei Integration konsolidieren. Bei erfolgreicher Provider-Rotation und fehlgeschlagenem DB-Commit erneute Verbindung statt blindem Retry.
- Offizielle TikTok-Dokumentation vom 05.11.2026 bestätigt Rotation; Twitch fordert regelmäßige Validierung. Älteres Main enthält bereits Twitch-Lifecycle-Vertrag, Implementierung gezielt prüfen/portieren; #50 EventSub-Revocation erhalten. Entwickler-Freigabematrix in #112, keine tatsächlichen App-Freigaben bestätigt. YouTube aktuelle Dokumentation beschreibt keine generelle Private-only-Pflicht mehr, konkrete Projektfreigabe prüfen.
- Nächster Block: CI #112/#111, Twitch-Lifecycle selektiv übernehmen, gemeinsame Publishing-Job-Zustände und sichere Idempotenz auf Basis von #111 vorbereiten. Produktions-DB-, Backup-, Admin- und Release-Gates bleiben offen. Kein Merge, Deploy, SQL-Schreibzugriff, Tarifwechsel oder tatsächlicher Upload.

## 12. Arbeitsfortschritt – Multi-Publisher Auftragsvertrag

- #110 [CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46096609067), #111 [CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46096848227), #112 [CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46097336213), #107 [CI vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46097360298). Reale Provider-/Browser-/DB-Abnahme weiterhin separat.
- PUB-03: [PR #113](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/113) als Folge von #111. Rein funktionaler Auftragsvertrag mit Wiederverwendung der Vorschauvalidierung, kontogebundenem Request-Key, Payload-Fingerprint, getrennten Zielzuständen, Revision/Attempt-ID, maximal drei Versuchen und zwingendem Statusabgleich nach unklarem Übertragungsergebnis. Keine DB-Persistenz, kein HTTP-Endpunkt, Worker, Upload oder tatsächlicher Doppelpostschutz in Produktion. Tests im vorhandenen Provider-Testlauf, CI ausstehend.
- Nächster Schritt: dauerhafte Job-Persistenz und atomare Idempotenz/Leases erst nach abgestimmter Migration, geprüfte Medienvarianten und Provider-Freigaben binden; Twitch-Token-Lifecycle aus älterem Main selektiv abgleichen (#50 EventSub-Widerruf erhalten). #110 → #111 → #113; #112 teilt Provider-Testskript, alle Imports bei Integration konsolidieren. Keine parallele Cut-Queue, kein neuer Migrationsslot, keine Produktionsänderung oder Deploy. DB-/Backup-/Admin-Gates bleiben offen.

## 13. Arbeitsfortschritt – Twitch-Lifecycle

- #113 [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46100088907); #107 [vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46100101724). Keine Persistenz-/Worker-Freigabe daraus ableiten.
- [PR #114](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/114) als Folge zu #112: vorhandener authentifizierter Twitch-Profil-Sync um App-/User-Validierung, reaktiven 401-Refresh, erneute Validierung, verschlüsselte Rotation, Account-Zeilenlock und HTTP-Deadline erweitert. Kein neuer Scope, keine neue OAuth-Verbindung oder Migration. Ältere Main-Verträge geprüft, keine pauschale Übernahme. Mock-Tests im bestehenden Provider-Lauf, CI offen.
- Noch offen: stündliche/Startup-Validierung, Revocation/Disconnect (#50 EventSub-Entwurf erhalten), reale PostgreSQL-/Provider-Abnahme und Wiederverbindung bei unklarer Rotation. Keine externe App-Freigabe bestätigt. #112 → #114 unabhängig von #110 → #111 → #113; Provider-Testimports bei Integration zusammenführen.
- Nächster Block: persistenter Publishing-Job-Schemaentwurf und isolierte Tests ohne produktive Migration, unveränderliche gerenderte Medienvarianten/Cut-Studio-Übergabe. DB-/Backup-/Admin-/Release-Gates bleiben bestehen; kein Merge, Deploy, produktiver Schreibzugriff, Tarifwechsel oder Upload.

## 14. Arbeitsfortschritt – isolierte Publishing-Entwurfspersistenz

- #114 Twitch-Lifecycle [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46102402086); stündliche Validierung, Widerruf und reale Abnahme bleiben offen.
- PUB-03: [PR #115](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/115) als Folge zu #113. Entwurfsspeicher mit bestehender Medien-/Accountprüfung, Transaktion/Zeilenlocks, Request-Key/Fingerprint, atomarer Zielanlage, SQL-Unique/FK/CHECK-Constraints und vorläufigem Limit 50. Nur draft, kein HTTP-Endpunkt/Worker, keine Veröffentlichung. Wiederholter identischer Request wird erkannt; keine Aussage über externe Doppelposts.
- Unregistrierte Schemafixture ausschließlich in scripts/fixtures; kein neuer Migrationsslot. Reale isolierte PG18-CI für parallele Requests, Kontotrennung, Rollback, Quota, gelöschte Medien, SQL-Guards vorbereitet. CI offen; #103 teilt check.yml, bei Integration beide Schritte erhalten. Bestehende Cut-Queue und Mediathek nicht ersetzt; keine neue Infrastruktur.
- Nächster Block: unveränderliche gerenderte Medienvarianten und Cut-Studio-Handoff, vollständiger persistenter Jobzustand/CAS/Lease/Reconciliation nach Schema-/Retention-Prüfung. #110 → #111 → #113 → #115; #112 → #114. DB-/Backup-/Admin-/Release-Gates bleiben offen. Kein Merge, Deploy, produktives SQL, Tarifwechsel oder Upload.

## 15. Arbeitsfortschritt – Cut Studio zur Publisher-Vorschau

- #115 [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46102811494), inklusive vorgesehenem isoliertem PostgreSQL-18-Test; #107 [vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46102825396). Kein produktiver Speicher freigegeben.
- [PR #116](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/116) ergänzt die vorhandenen Cut-Mediathek-Karten um einen internen Publisher-Vorschau-Link. Vorauswahl ausschließlich anhand der eigenen authentifizierten Medienliste; UUID-Fragment, keine Pfade/Tokens, kein automatischer POST, Entwurf oder Upload. Vorhandener Editor, API, HTML/CSS, Export-Queue und #106 unverändert. Mock-DOM-Tests eingebunden; CI und echte Browser-/Designabnahme offen.
- Lokale Launcher-Ausgaben weiterhin bewusst in Mediathek importieren, bestehendes 16-MiB-Limit. Keine Behauptung eines automatischen Export-Handoffs oder geprüfter Render-Bytes. #50 überlappt beide JS-Dateien, selektiver Abgleich erforderlich. Referenzbilder nicht visuell geöffnet; kein Designfreigabe-Nachweis.
- Nächster Block: private und unveränderliche Ausgabevarianten, Content-Hash und tatsächliche Medien-/Codecprüfung, sichere Übertragung größerer Dateien, danach persistente Ausführung/Freigabe. #110 → #111 → #113 → #115 → #116; #112 → #114. DB-/Backup-/Admin-/Release-Gates bleiben offen. Kein Merge, Deploy, produktives SQL, Tarifwechsel oder externe Veröffentlichung.

## 16. Neupriorisierung – Website-weite technische Bestandsaufnahme

- Betreiberwunsch: vor weiterer Multi-Publisher-Entwicklung zuerst alle anderen Website-Funktionen technisch prüfen und für späteren Codex-Umbau konsolidieren. [Technisches Inventar und Integrationsreihenfolge](WEBSITE3_TECHNICAL_INVENTORY.md) ergänzt. 29 offene PRs (27 Drafts), main unverändert; #116 [CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46103105441).
- P0: Admin-Autorisierung ist trotz vorhandenem strikten Helper noch nicht konsistent (E-Mail-basierte Pfade in auth.js/projects.js/mfa-login.js); echte DB-/Backup-/Restore-/MFA-Abnahme und Statuswahrheit vor Funktionsausbau. P1: #50 selektiv aufteilen, Launcher-/OBS-/Stream-/Scene-/Widget-/Audio-/Cut-Kern und PS/Games prüfen. Design #101 nach Referenz-/Mockup-Abnahme schrittweise integrieren.
- Branch feat/publisher-private-stream-staging-2026-11-28 lediglich angelegt; keine neue Publishing-Codeänderung oder PR. Keine Datenbank-, Render-, Tarif- oder Produktionsänderung. Codex-Umsetzung folgt als separater, gezielter Auftrag nach dieser Bestandsaufnahme.

## 17. Arbeitsfortschritt – SEC-01 Admin-Konsolidierung

- Neue read-only Neon-Prüfung: Produktion und Backup-Restore vom 26.11. jeweils Betreiberkonto vorhanden, explizite Adminrolle und E-Mail-Bestätigung fehlen. **Produktiver Rollout blockiert** (Lockout). Keine Kontodaten ausgegeben, keine Rollen- oder DB-Änderung.
- [PR #117](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/117) als Folge zu #103: vorhandenen strikten Admin-Helper in Passwort-/MFA-Login, Sessions, Account-/Profil-Ansicht, Admin-Endpunkten und Creator-Entitlements konsolidiert. Isolierte PG18-HTTP-Tests und bestehende Unit-Tests erweitert; CI ausstehend. Keine neue Migration. Historische #26/#47/#52 nicht zusätzlich mergen; #50/#110 Server-Überlappungen gezielt abgleichen.
- Vor Freigabe: verifizierter vollständiger Restore, autorisierte Betreiberidentitäts-/E-Mail-Prüfung und explizite Rollenprovisionierung zunächst im isolierten Klon, Admin-Preflight/MFA/Recovery/Session-Widerruf, getrennte Produktionsfreigabe. Keine automatische Rollenvergabe oder unsichere Fallback-Regel. Weitere Arbeit: CI, DB-/Backup-Gates und korrekte Statusmodelle, danach Launcher/Creator-Kern. Multi-Publisher-Ausbau bleibt pausiert.

## 18. Arbeitsfortschritt – belegte Creator-Systemzustände

- #117 [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46105577549); Betreiber-Lockout-Gate bleibt bestehen. #107 [vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46105593918).
- [PR #118](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/118) als Folge zu #110, unabhängig vom pausierten Publishing-Ausbau: accountgebundene Provider-Metadaten, einheitliches 2-Minuten-Heartbeat-Fenster, gekoppelt/online/OBS-Meldung, technische Statuskomponenten, keine Fake-Follower/Zuschauer oder Release-Freigabe allein anhand HTTP 200. Vorhandenes Dashboard/System-Check-Layout erhalten. Tests erweitert; CI und echte Browser-/Geräte-/Provider-Abnahme offen. Keine neue Migration, Route oder Tarifberechtigung.
- Nächster Schritt: Creator-Setup (UI sendet PUT auf Launcher-Modulpfad, Backend derzeit nur GET) und vorhandenen Creator-Settings-Vertrag abgleichen; Tool-Katalog/Entitlements nicht erfinden. Danach Launcher-Claim/Pairing/OBS aus #50 selektiv konsolidieren. Öffentliches LIVE/PlayStation/Discord separat prüfen. #110 zuerst; #50/#103/#117 Serverüberlappung und Provider-Testimports konsolidieren. Keine Produktionsänderung oder Deploy.

## 19. Arbeitsfortschritt – Creator-Setup-Persistenz

- #118 [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46112660939); #107 [vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46112675584). Reale Geräte-/Provider-/Browser-Abnahme offen.
- [PR #119](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/119) als Folge zu #118: vorhandener Setup-PUT speichert im bestehenden creator_settings-Namespace, Account-Lock und SHA-256-Content-Version, strikte Eingabeprüfung, Erhalt übriger Einstellungen, kein Device-/Rollen-/Tarifwechsel. Generischer Settings-PUT erhält Setup; direkte Setup-Schreibversuche dort 409. Bestehende Setup-/Dashboard-UI angepasst, PG18-HTTP-Tests für Konto-Isolation und konkurrierende Änderungen ergänzt. CI/Browser-Abnahme ausstehend. Keine neue Route/Tabelle/Migration.
- #117 berührt creator-settings.js und HTTP-E2E-Test; Admin-Policy bei Integration gezielt erhalten. Ältere externe Clients auf geänderten Setup-Schreibvertrag prüfen; keine monotone Revision und keine eigenständige Setup-Zeitspalte. Nächster Block: tatsächlicher gemeinsamer Tool-Katalog und Entitlements, dann exakte Launcher-Claim-Gerätebindung und OBS-/Streaming-Funktionen aus #50 selektiv. Multi-Publisher pausiert, Produktions-/Backup-/Admin-Gates unverändert.

## 20. Arbeitsfortschritt – gemeinsamer Creator-Modulkatalog

- #119 [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46114800508); reale geräteübergreifende Abnahme und Altclient-Kompatibilität offen.
- [PR #120](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/120) als Folge zu #119: 16 vorhandene Modulziele, Navigation/Entwicklungsstand/Runtime/Produktionsfreigabe getrennt. Vorhandene Widget-/Scene-/Export-/Stream-Limits zentral wiederverwendet, Medien-/Asset-Limits aus vorhandenen Quota-Modulen. Unbekannter Widget-Plan erhält konservativ 3 statt bisher 100; keine Löschung, keine neue Tarifberechtigung, kein Billing. Dashboard und vorhandene Creator-Suite-Beschreibungen verwenden Katalog. CI und reale Browser-/Design-/Geräteabnahme offen.
- #110 → #118 → #119 → #120; #117 und #50 bei Konsolidierung selektiv berücksichtigen, Provider-Testimports erhalten. Nächster Schritt: Launcher-Claims exakt an ausführendes Gerät binden, vorhandene Desktop-/OBS-Engine abgleichen. Multi-Publisher pausiert; keine produktiven DB-/Render-/Tarifänderungen.

## 21. Arbeitsfortschritt – Launcher-Export-Claims

- #120 [vollständige Website-CI grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46115021190), #107 [vor diesem Update grün](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46115035850).
- [PR #121](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/121) auf #117 (#103/Recovery 026): selektive Gerätebindung aus #50 als Migration 027; vorhandene Konto-/Jobtyp-/Revocation-Transaktionsgrenzen bleiben. Read-only Neon Produktion/Staging/Recovery: Claim-Spalte fehlt, jeweils 0 claimed/processing. Kein Backfill/Requeue; alte ungebundene Claims fail closed. Neue PG18-HTTP-Tests, Upgrade-/Restore-/Readiness-Tests angepasst; CI offen. Keine Migration ausgeführt. Shared-Secret/Device-ID bleibt (keine individuelle kryptografische Geräteauthentifizierung); reale Geräteabnahme und späterer Drain/Freigabe nötig.
- #120 zentralen Queue-Limit-Import, #108/#109/#119 Tests bei Integration erhalten; #50 nicht blind übernehmen. Nächster Schritt: Launcher-Authentifizierung/Pairing und OBS-Desktop-Bestand gezielt prüfen. EventSub-Migration 028 erst separat. Multi-Publisher pausiert; produktiver Admin-/Backup-/DB-Rollout bleibt blockiert.

## 22. Codex-Staging als Integrationsgrundlage (28.11.2026)

- Codex-HEAD 0223110bf572779ab6759c13ee8fa3f6c6cec09b auf security/staging-neon-tls-20261125; 15 Commits vor, 42 hinter main. Laut DEVELOPMENT_OVERVIEW.md lokale npm-CI-Abhängigkeiten und npm run check bestanden; öffentliche Homepage/Login bei sieben Breiten geprüft, vollständige Screenshot-Dateien und geschützte Seiten-/PG18-Abnahme fehlen. Keine parallele Designarbeit; aktuelle Staging-Branch bleibt unverändert.
- #103/#108/#109/#117/#121 selektiv in Codex-Staging bearbeitet; nicht doppelt mergen. #121 [CI fehlgeschlagen](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46116762349): alte Assertion 26 statt 27, PG-Schritte übersprungen. Codex korrigierte diese Assertion, aber Staging-Backup-Test erwartet noch 25 Migrationen. Migration 026: unterschiedliche SQL-Dateien/Indexnamen, vorhandener Recovery-Ledger passt zur früheren #103-Textvariante (einschließlich Zeilenendvarianten), nicht zur Staging-Variante. Exakte ursprüngliche Bytes/Katalog abgleichen, keine Ledger-Manipulation. Betreiber-/vollständige Backup-Abnahme bleibt offen.
- [PR #122](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/122) als reiner Dokumentations-/Abnahme-Entwurf auf dem exakten Codex-Staging-Stand; vorhandene CI nutzt isolierte lokale PG18-Service-DB. Kein Anwendungs-/Designcode, kein Deploy, keine Produktionstests. CI ausstehend; nicht mergen. Abnahmeplan in docs/operations/STAGING_ACCEPTANCE_2026-11-28.md.
- Nächste Codex-Aufgabe: CI-Fehler und Migration-026-Konflikt klären; echte PG18-Concurrency-/Launcher-/Restore-Tests, dann authentifizierte Browserabnahme. Main-Deltas selektiv erhalten. Danach #110 → #118 → #119 → #120 integrieren; #112/#114/#106 und #50 separat prüfen. Multi-Publisher bleibt pausiert. Kein produktiver Rollout.

## 23. Integrierte PG18-Abnahme des Codex-Stands

- [PR #122, CI 46125880466](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/46125880466): npm ci/check, Backup-Refusal, PG18 Account-/Creator-E2E, Read-only-Preflight (27 Ledger-Einträge), Legacy-Baseline/Upgrade und Legacy-Dump/Restore erfolgreich. Abschließender Backup-Test nach pg_restore an alter 25er-Assertion fehlgeschlagen; folgende Fingerprint-/ACL-Abnahme nicht erreicht.
- Korrektur 3cffc528c9aca32b73ecaed99e96b862e85cfa7c im Audit-Zweig: manifestbasierte erwartete Anzahl, beide Ledger müssen übereinstimmen; zusätzliche Tabellen password_recovery_attempts/launcher_devices/tool_jobs im Fingerprint. Neue CI ausstehend. Keine Änderung der Staging-Anwendung, keine produktive Migration. Recovery-Ledger 026 weiterhin abgleichen.
- Nächster Codex-Auftrag: Testkorrektur übernehmen, Migrationshistorie 026 exakt klären, reale isolierte Recovery-/Launcher-Paralleltests ergänzen und geschützte Browserseiten mit synthetischen Konten abnehmen. Danach Creator-Grundintegration #110/#118/#119/#120, kein paralleles Redesign oder Multi-Publisher-Ausbau.
