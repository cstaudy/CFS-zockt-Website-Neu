# Provider-Entwicklerfreigaben und Token-Lifecycle

Stand: 28.11.2026. CORE-01 / PUB-01, zentrale Roadmap #107, Capability-Entwurf #110.

## TikTok: erste Umsetzung
- Bestehendes OAuth und vorhandene verschlüsselte Connection-Zeile wiederverwenden. Der authentifizierte Profil-Sync erneuert einen abgelaufenen bzw. in weniger als 60 Sekunden ablaufenden Zugriffstoken. Kein automatischer Hintergrundjob, keine Änderung des öffentlichen Video-Feeds.
- Ein PostgreSQL-Zeilenlock pro Account serialisiert Refresh-Aufrufe über Instanzen; begrenzte Lock-Wartezeit und HTTP-Timeout. Neue Access- und Refresh-Tokens, tatsächliche Ablaufzeiten und zurückgelieferte Scopes in derselben Zeile speichern; Identität prüfen. Keine Scope-Erweiterung, kein Token in HTTP-Antwort/Logs, kein erneuter Refresh bei unklarer Antwort.
- OAuth-Callback verwendet das dokumentierte Feld `refresh_expires_in`, keine erfundene Standardlaufzeit. Alte gespeicherte Ablaufwerte können falsch sein; Provider-Ablehnung führt zur erneuten Verbindung. Wenn Provider-Rotation erfolgreich, aber DB-Commit fehlgeschlagen ist, ist Wiederverbindung erforderlich; kein automatisches Wiederholen mit altem Token.
- Mock-Tests für Rotation, Account-Bindung, Abläufe, Fehler, Rollback und fehlende Rechte. Echte PostgreSQL-Parallelitäts-/Provider-Tests und CI stehen aus. Kein produktiver Provider-Aufruf im Entwicklungsprozess.

## Freigabematrix
| Provider | Aktueller CFS-Stand | Nächste Freigabe / Voraussetzung |
| --- | --- | --- |
| TikTok | OAuth mit user.info.basic,video.list; Refresh im Entwurf | Bestehende App in Developer Portal prüfen; Content Posting API aktivieren; video.upload (Entwurf in TikTok) oder video.publish (Direct Post) separat genehmigen und Nutzer erneut zustimmen lassen. Creator Info, erlaubte Sichtbarkeit, Dauer, Interaktionen, kommerzielle Angaben und bewusste Freigabe pro Post; Audit für öffentliche Direct Posts. |
| Twitch | OAuth vorhanden; älteres Main-Repo enthält Lifecycle-Vertrag | Vorhandene Implementierung selektiv prüfen/übernehmen; Refresh bei 401, Validierung beim Start und mindestens stündlich für aktive OAuth-Sitzungen, Client/User-Bindung, Revocation, konkurrierende Refreshs; kein allgemeiner Datei-Upload versprochen. |
| YouTube | OAuth/Upload in Website 3 geplant | Google Cloud Projekt, YouTube Data API, youtube.upload, OAuth-Consent/Verifizierung je App-Zielgruppe; aktuellen Quota-/Compliance-Status und tatsächliche Upload-Sichtbarkeit prüfen. Offizielle Dokumentation meldet aktuell, dass unbestätigte Projekte nicht mehr generell auf private Uploads beschränkt sind; keine individuelle Freigabe daraus ableiten. |
| Instagram / Facebook | Geplant | Meta Developer App; Login-Produkt, professionelles Konto bzw. Seite, passende Publishing-Rechte und Review/Advanced Access nach Zielgruppe. |
| Kick / Custom RTMP | Live-Ziele | Keine unbestätigte Datei-Publishing-Funktion anbieten. |

Externe Developer-Portale und echte App-Freigaben wurden nicht eingesehen. Keine Secrets anfordern oder in GitHub speichern. TikTok/Twitch-Berechtigungen in diesem Entwurf unverändert. Bestehende #50 EventSub-Revocation nicht überschreiben; #110 teilt Provider-Testskript, beim Merge beide Imports erhalten.

Offizielle Dokumentation (erneut geprüft 28.11.2026):
- https://developers.tiktok.com/docs/en/oauth-refresh-a-user-access-token
- https://developers.tiktok.com/docs/en/oauth-get-a-user-access-token
- https://developers.tiktok.com/docs/en/content-sharing-guidelines
- https://developers.tiktok.com/docs/en/content-posting-api-get-started
- https://dev.twitch.tv/docs/authentication/refresh-tokens/
- https://dev.twitch.tv/docs/authentication/validate-tokens/
- https://developers.google.com/youtube/data/guides/quota_and_compliance_audits
- https://developers.facebook.com/docs/instagram-platform/

## Abnahme
Keine öffentliche Veröffentlichung, neue OAuth-Scopes, produktive Migration, Kosten oder Deployment ohne getrennte Freigabe. Öffentlicher Feed, explizite Provider-Revocation, Twitch-Lifecycle und Publishing-Jobs sind weitere Arbeitspakete. Rollback: PR nicht mergen oder zusammengehörige Code-/Test-/Dokumentationsänderungen revertieren; bereits rotierte Provider-Tokens niemals durch alte Werte ersetzen.

## Twitch: bestehende Profil-Synchronisierung erweitern (Folge-PR zu #112)

- Referenz: älteres `cfs-zockt-Website-main`, `lib/provider-oauth-contract.js` und `tools/twitch-oauth-v143-test.mjs` dokumentieren den Lifecycle. Der große alte Server wurde nicht als Ganzes übernommen; die aktuelle Connection-Tabelle und Verschlüsselung bleiben erhalten.
- Der authentifizierte, bestehende Profil-Sync prüft den Access-Token beim offiziellen Validate-Endpunkt; Client-ID, User-ID, Laufzeit und Scope-Liste müssen passen. Nur bei HTTP 401 wird einmal ein Refresh versucht. Anschließend wird der neue Token erneut validiert, bevor verschlüsselte Tokens und tatsächliche Scope-/Ablaufmetadaten gespeichert werden.
- Account-Zeilenlock, begrenztes Lock-Warten und gemeinsamer HTTP-Timeout; Profiländerung bleibt unter demselben Lock, keine neue OAuth-Berechtigung oder neue Tabelle. Bei einem HTTP-/Identitätsfehler im Profil-Sync nach erfolgreicher Token-Rotation wird die Rotation trotzdem gespeichert. Schlägt die DB-Transaktion nach externer Rotation fehl, kann Wiederverbindung nötig sein; keine automatische Wiederholung innerhalb desselben Aufrufs.
- Keine Tokens, Provider-Rohfehler oder Secrets in HTTP-Ergebnis oder Logs. Bestehendes Profil-Ergebnisformat bleibt erhalten.
- Noch offen: Start-/stündliche Validierung aktiver Twitch-Sitzungen, Revocation und Disconnect-Policy (EventSub-Entwurf #50 gezielt erhalten), echte PostgreSQL-Rennen/Timeouts, sichere Behandlung unklarer Refresh-Antworten über mehrere Aufrufe, reale Provider-Abnahme. Der Entwurf allein erfüllt nicht den gesamten Twitch-Lifecycle und aktiviert keine Live-/Publishing-Funktion.
- Offizielle Referenzen erneut geprüft: https://dev.twitch.tv/docs/authentication/refresh-tokens/ und https://dev.twitch.tv/docs/authentication/validate-tokens/ .
- Tests im vorhandenen Provider-Testskript: Token- und App/User-Bindung, Rotation auf 401, Lock-/Account-Vertrag, Profilfehler, Rollback, keine Secret-Ausgabe. CI und reale Abnahme offen. #112 zuerst integrieren; #110/#111/#113 teilen Provider-Testskript; #50 berührt twitch.js, beim thematischen Split gezielt zusammenführen. Kein produktiver SQL-Zugriff, Deploy, neuer Scope oder Tarifwechsel.
