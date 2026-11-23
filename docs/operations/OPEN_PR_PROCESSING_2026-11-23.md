# Offene Pull Requests – Abarbeitung 2026-11-23

## Ergebnis

Am 23.11.2026 wurden alle 17 offenen Pull Requests des Repositorys `cstaudy/CFS-zockt-Website-Neu` aus GitHub abgerufen und gegen den aktuellen `main`-Stand (`7808447`) bewertet. Es wurde kein bestehender Pull Request gemergt, geschlossen oder in Produktion deployed. Es wurden keine produktiven Datenbankänderungen vorgenommen.

Die bereits angelegten Draft-PRs #100, #101 und #103 bleiben die einzigen aktiven Arbeitsstände für Audit, CFS Identity V1 und Passwort-Recovery. Für die Gesamtbearbeitung wird dieser Bericht als separater Draft-PR geführt.

## Entscheidungs- und Arbeitsmatrix

| PR | Thema | GitHub/CI-Befund | Abarbeitung | Nächster sicherer Schritt |
|---:|---|---|---|---|
| #11 | Designsystem v2 | offen, nicht Draft, `mergeable=false`, kein PR-Workflow-Lauf | **Überholt durch CFS Identity V1**; nicht parallel übernehmen | Mit Eigentümerbestätigung schließen oder als historische Referenz behalten |
| #12 | Referenzdesign global | offen, `mergeable=true`, kein PR-Workflow-Lauf | **Überholt durch CFS Identity V1/#101**; enthält globale CSS-Ersetzung | Nicht mergen; nur gezielte Tokens/Komponenten aus #101 verwenden |
| #26 | Admin: verifizierte E-Mail + Rolle | Draft, `mergeable=false`, Workflow #44 erfolgreich | **Blockiert**: Variantenkonflikt mit #47/#52 und fehlender Produktions-/Operator-Abnahme | Eine einzige aktuelle Admin-Variante auswählen, rebasen, Backup/Restore und Operator-MFA in Staging prüfen |
| #33 | MFA Login-Challenge | Draft, gestapelt auf alter MFA-Basis, Workflow #35 erfolgreich | **Nicht isoliert mergebar**; Teil einer Kette #33–#43 | Kette auf aktuellem `main` neu aufbauen und als konsolidierten Sicherheits-PR testen |
| #34 | Gehashte Recovery-Codes | Draft, auf #33 gestapelt, Workflow #37 erfolgreich | **Nicht isoliert mergebar**; Teil der MFA-Kette | Nur im konsolidierten MFA-PR übernehmen |
| #35 | Atomare MFA-Deaktivierung | Draft, auf #34 gestapelt, Workflow #38 erfolgreich | **Nicht isoliert mergebar**; Teil der MFA-Kette | Konsolidiert rebasen und Lock-/Session-Tests erneut ausführen |
| #36 | Atomare MFA-Aktivierung/Rotation | Draft, auf #35 gestapelt, Workflow #39 erfolgreich | **Nicht isoliert mergebar**; Rotation benötigt Rate-/Cooldown-Kontext | Mit #37–#43 zusammenführen, nicht einzeln mergen |
| #37 | Recovery-Rotation-Cooldown | Draft, auf #36 gestapelt, Workflow #40 erfolgreich | **Nicht isoliert mergebar** | In konsolidiertem MFA-PR behalten, Migrationen sequenzieren |
| #41 | TOTP-Replay-Schutz | Draft, auf #37 gestapelt, Workflow #55 erfolgreich | **Nicht isoliert mergebar** | Rebase auf aktuellem `main`, E2E- und Parallel-Login-Test |
| #42 | MFA-Challenge-Ausgabelimit | Draft, auf #41 gestapelt, Workflow #56 erfolgreich | **Nicht isoliert mergebar** | Nach konsolidiertem Rebase und Staging-DB-Test prüfen |
| #43 | Konsistente Lock-Reihenfolge | Draft, auf #42 gestapelt, Workflow #57 erfolgreich | **Nicht isoliert mergebar** | Bestandteil des konsolidierten MFA-PRs |
| #47 | Admin-Variante auf aktuellem `main` | Draft, `mergeable=false`, Workflow #73 erfolgreich | **Blockiert/dupliziert #26 und #52** | Eine Variante behalten; Operator-Wiederherstellung und MFA-Abnahme vor Release |
| #50 | Creator Suite/OBS/Launcher/Twitch/PlayStation | Draft, `mergeable=false`, 265 Commits/85 Dateien, Workflow #338 erfolgreich | **Zu groß für sicheren Einzel-Merge**; enthält Migrationen 026/027 und viele Produktbereiche | In kleine, einzeln testbare PRs splitten; keine Migration aus dem Draft direkt übernehmen |
| #52 | Admin-Variante (englische Fassung) | Draft, `mergeable=false`, Workflow #342 erfolgreich | **Blockiert/dupliziert #26/#47** | Nicht mergen; nach Variantenauswahl verwerfen oder als Referenz markieren |
| #100 | Vollständiger Audit/Design-Vorschlag | Draft, `mergeable=true`, Workflow #651 erfolgreich | **Erledigt als Dokumentationsbasis** | Review der Dokumente; kein Produktionsschritt |
| #101 | CFS Identity V1 Tokens/Komponenten | Draft, `mergeable=true`, Workflow #652 erfolgreich | **Arbeitsstand bereit für Review**; keine Produktionsänderung | Bild-/Codeabnahme, danach schrittweise Seitenerweiterung |
| #103 | Passwort-Recovery (Issue #102) | Draft, `mergeable=true`; erster Workflow #653 scheiterte an veraltetem Testwert `5 !== 4` | **Fehler behoben** in Commit `5fdd5ea` (Legacy-Erwartung 4 → 5); Push erfolgt, neuer CI-Lauf ausstehend | CI erneut erfolgreich abwarten; Migration 026 vor Kombination mit #50 neu nummerieren |

## Technische Befunde

1. **Migrationen sind der zentrale Integrationskonflikt.** #33–#43 führen 022–025 ein. #103 führt 026 für Passwort-Recovery ein. #50 verwendet ebenfalls 026/027 für andere Produktfunktionen. Daher darf keiner dieser Zweige blind zusammengeführt werden. Vor einer Freigabe muss eine einzige fortlaufende Migrationshistorie mit neu erzeugten Checksummen erstellt und in einer isolierten Datenbank getestet werden.
2. **Erfolgreiche historische CI-Läufe sind kein Merge-Signal.** Die Workflows der MFA- und Admin-Drafts liefen auf ihren jeweiligen, teilweise gestapelten Basen erfolgreich. Das beweist nicht, dass sie gegen den aktuellen `main`-Stand oder gemeinsam mit anderen Migrationen integrierbar sind.
3. **#103 ist inhaltlich lokal geprüft.** Passwort-Recovery-Vertrag, Token-Fragment, sichere Origin-Prüfung, Rate-Limit-Vertrag, Migration-Runner, Passwortregeln und HTML-Integrität wurden lokal geprüft. Der erste GitHub-Lauf scheiterte ausschließlich am nicht aktualisierten Legacy-Erwartungswert; dieser wurde korrigiert. Ein echter Provider-Mailversand und produktive/Neon-E2E-Prüfungen bleiben bewusst aus.
4. **Produktionsfreigabe bleibt gesperrt.** Es fehlen weiterhin isolierter verifizierter Backup/Restore-Nachweis, Staging-Datenbankisolation, Operator-Admin/MFA-Abnahme, echte Geräte-/Provider-Abnahme und eine ausdrückliche Deploy-Freigabe.

## Reihenfolge für die weitere Bearbeitung

1. CI-Nachlauf von #103 abwarten und danach die Migration 026 im Integrationsplan eindeutig reservieren.
2. #101 als Design-Basis fachlich prüfen; keine globale Umsetzung außerhalb des Drafts.
3. Aus #50 nur klar abgegrenzte Creator-/Studio-Funktionen als neue kleine Draft-PRs herauslösen.
4. MFA #33–#43 auf aktuellem `main` als einen Sicherheits-PR neu aufbauen und die Migrationen 022–025 ausschließlich in einer isolierten DB prüfen.
5. Eine Admin-Variante (#26, #47 oder #52) auswählen; die anderen nicht parallel weiterentwickeln.
6. Erst danach Staging-/Backup-Nachweise erbringen und eine separate Freigabeentscheidung vorbereiten. Merge, Deployment und Produktionsdatenbank bleiben bis dahin ausgeschlossen.

