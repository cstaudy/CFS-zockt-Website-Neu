# Produktionsmigration Render PostgreSQL -> Neon

Dieses Runbook ist eine Vorbereitung. Es führt keine Sicherung, keinen Restore,
keine Datenbankänderung und kein Deployment automatisch aus. Zugangsdaten werden
nur interaktiv als lokale Eingabe verarbeitet und nie als Argument, Datei, Git-
Änderung oder Protokollwert verwendet.

## Vorbedingungen

- Branch `security/production-neon-tls-20261125` ist geprüft und sauber.
- Die unabhängige Sicherung wird außerhalb des Repositorys abgelegt.
- `pg_dump`, `pg_restore` und `psql` sind vorhanden.
- Die Ziel-Datenbank für den Restore ist leer, isoliert und nicht produktiv.
- Die bestehende Render- und Neon-Produktionskopie werden vor dem Umschalten nur gelesen.

## 1. Unabhängigen Dump erstellen

Zielpfad außerhalb des Repositorys wählen, idealerweise auf einem geschützten,
separaten Datenträger oder einem freigegebenen Backup-Ziel:

```powershell
powershell -NoProfile -File .\scripts\production-pg-backup.ps1 `
  -Action Dump `
  -DumpFile 'D:\cfs-zockt-backups\render-pre-neon-YYYYMMDD-HHmm.dump'
```

Das Skript fragt Host, Port, Datenbank, Benutzer und Passwort interaktiv ab,
verwendet TLS `verify-full` mit dem libpq-System-CA-Speicher (`sslrootcert=system`), erzeugt ein PostgreSQL-Custom-Format und schreibt
nur ein SHA-256-Manifest neben die Dump-Datei. Vorhandene Dateien werden nicht
überschrieben.

### Alternative: Neon-Produktionskopie

Wenn die Render-Quelle nicht erreichbar oder bereits eingefroren ist, darf
ausschliesslich der direkte Neon-Endpunkt des Branches `production` verwendet
werden. Pooler-Endpunkte (`-pooler`) sind fuer `pg_dump` nicht zulaessig. Das
Skript setzt fuer Neon zusaetzlich `channel_binding=require`, laedt bei
`-FetchOfficialRoots` das offizielle Let's-Encrypt-X1/X2-Bundle per `-OutFile`
und validiert die SHA-256-Fingerprints vor der Verbindung:

```powershell
powershell.exe -NoProfile -File .\scripts\production-pg-backup.ps1 `
  -Action Dump `
  -Provider Neon `
  -DumpFile 'C:\Users\cstau\CFS-Backup\neon-production-YYYYMMDD-HHmmss.dump' `
  -HostName 'ep-plain-shadow-badv1kt1.c-8.eu-central-1.aws.neon.tech' `
  -Port 5432 `
  -Database 'cfs_zockt_render_import' `
  -User 'cfs_zockt_render_import_owner' `
  -FetchOfficialRoots -NativePasswordPrompt -KeepWindowOpen
```

Die lokale native Passwortabfrage wird nicht in Git, Dateien oder Logs
gespeichert. Bei `Dump` wird der separate `psql`-TLS-Probe im nativen Prompt-
Modus uebersprungen; `pg_dump` selbst erzwingt `verify-full`, damit das
Passwort nur einmal abgefragt wird.

## 2. Restore-Prüfung vorbereiten

Eine leere isolierte Testdatenbank bereitstellen. Das Anlegen dieser Datenbank
ist ein separater, ausdrücklich freizugebender Schritt. Danach:

```powershell
powershell -NoProfile -File .\scripts\production-pg-backup.ps1 `
  -Action Verify `
  -DumpFile 'D:\cfs-zockt-backups\render-pre-neon-YYYYMMDD-HHmm.dump' `
  -TargetDatabase 'cfs_zockt_restore_check_YYYYMMDD' `
  -ConfirmIsolatedDatabase
```

Der Zielpfad muss auf einem lokalen, vollstaendig BitLocker-verschluesselten
und geschuetzten Laufwerk ausserhalb von Git und OneDrive liegen. Der Dump wird
abgebrochen, wenn der BitLocker-Status nicht gelesen werden kann oder der
Schutz nicht aktiv ist. Das SHA-256-Manifest ist fuer jede Verify-Pruefung
zwingend.

Wenn Windows/libpq den System-CA-Speicher nicht laden kann, kann mit
`-RootCertificatePath` ein externes PEM-Bundle verwendet werden. Das Skript
akzeptiert dabei nur ein Bundle mit dem offiziellen Let's-Encrypt-Root X1 oder
X2 (SHA-256-Fingerprints im Skript), behaelt `verify-full` und die
Hostnamenpruefung bei. Das Bundle bleibt ausserhalb des Repositorys.

Vor dem Restore wird geprüft, dass die Zieldatenbank leer ist. Danach werden der
Dump in einer Einzeltransaktion wiederhergestellt und 26 öffentliche Tabellen
verifiziert. Das Skript verwendet weder `--clean` noch `DROP DATABASE`.

Fuer die vollstaendige Restore-Pruefung fragt der Node-Validator danach die
Neon-Produktionskopie und das isolierte Ziel read-only ab und vergleicht
Tabelleninventar, Zeilenanzahl und einen deterministischen Inhaltsfingerabdruck
jeder der 26 Tabellen. Die Zielpruefung bleibt auf die isolierte Datenbank
beschraenkt.

Fuer die aktuelle Neon-Sicherung kann der ergaenzende Node-Validator mit den
beiden direkten Neon-Endpunkten ausgefuehrt werden. Er verwendet die
installierten `pg_restore`-/`psql`-Werkzeuge, `verify-full`, das gepruefte
Let's-Encrypt-Bundle und `channel_binding=require`. Die beiden Passwoerter
werden durch die native PostgreSQL-Passwortabfrage angefordert und weder als
Argument noch als Datei oder Protokollwert verarbeitet. Der Validator benoetigt
dafuer wenige native Verbindungen: Ziel-Leerpruefung, Restore sowie je eine
gebuendelte Inventarpruefung fuer Quelle und Ziel:

```powershell
node .\scripts\validate-neon-restore.mjs `
  'C:\Users\cstau\CFS-Backup\neon-production-20261126-203428.dump' `
  'ep-plain-shadow-badv1kt1.c-8.eu-central-1.aws.neon.tech' `
  'cfs_zockt_render_import' `
  'cfs_zockt_render_import_owner' `
  'ep-withered-glitter-barlhdl3.c-8.eu-central-1.aws.neon.tech' `
  'cfs_zockt_backup_restore_20261126' `
  'cfs_zockt_render_import_owner' `
  'C:\Users\cstau\CFS-Backup\neon-letsencrypt-roots.pem'
```

Der Validator bricht bei einem nicht leeren Ziel ab, stellt mit
`--single-transaction` wieder her und vergleicht danach alle 26 Tabellen,
Datenfingerprints, Sequenzen, Indizes und Constraints. Fuer jede Verbindung
verwendet er ausschliesslich die native `psql`-/`pg_restore`-Passwortabfrage;
es gibt keinen eigenen Node-/PowerShell-Prompt und kein `PGPASSWORD` oder
`PGPASSFILE`. Er verwendet weder `--clean` noch `DROP DATABASE`.

## 3. Kontrollierter Schreibstopp

Die Produktions-Branch enthält dafür den fail-closed Schalter
`CFS_MAINTENANCE_MODE=true`. In diesem Modus bleiben nur Health-, Readiness-,
Integrations- und öffentlicher Status-Endpunkt erreichbar; alle anderen API-
Pfade, einschließlich ungewöhnlicher schreibender GET-Pfade, liefern HTTP 503.
Statische Seiten bleiben auslieferbar.

Die nicht unter `/api/` liegenden OAuth-Callbacks `/auth/tiktok/callback` und
`/auth/twitch/callback` werden ebenfalls fail-closed blockiert, weil sie bei
erfolgreicher Rückkehr Providerdaten schreiben können.

Der Normalwert ist `CFS_MAINTENANCE_MODE=false`. Der Schalter wird fuer die
Migration auf jeder laufenden Produktionsinstanz gesetzt und erst nach der
Abnahme wieder entfernt; ein einzelnes altes Render-Exemplar darf nicht weiter
Schreibzugriffe annehmen.

Reihenfolge beim echten Cutover:

1. Launcher-Clients, externe Schedulers und sonstige API-Clients anhalten.
2. Render-Service auf Wartung/keinen Traffic stellen, damit alte Instanzen keine
   Schreibzugriffe mehr akzeptieren.
3. Neue Revision mit `CFS_MAINTENANCE_MODE=true` starten und nur Health/Ready prüfen.
4. In-flight-Anfragen auslaufen lassen; anschließend finalen read-only Abgleich
   und den unabhängigen Dump durchführen.
5. Erst danach `DATABASE_URL` auf den direkten Neon-Endpunkt ohne `-pooler`
   setzen und `DATABASE_SSL=true` prüfen. Da `scripts/start.js` vor dem
   Serverstart `scripts/migrate.js` mit derselben Variablen ausführt, darf für
   diesen Cutover kein gepoolter URL-Endpunkt verwendet werden.
6. Revision deployen, Logs und `/api/health`/`/api/ready` prüfen.
7. Auth, Passwort-Recovery, E-Mail-Verifizierung, Adminzugang sowie je einen
   Creator-Lese-/Schreibpfad testen.
8. Wartungsmodus erst nach erfolgreicher Abnahme entfernen.

Es gibt in dieser Branch keinen separaten Worker-Prozess. Launcher-Heartbeat,
Job-Claiming, PlayStation-Sync und Tool-Job-Updates sind dennoch relevante
API-Schreibwege und werden vom Wartungsmodus blockiert.

## 4. Finaler Abgleich

Während des Schreibstopps read-only prüfen:

- alle 26 Tabellen und Zeilenanzahlen Render gegen Neon,
- Primärschlüssel-/Unique-Anzahl und kritische Betreiberkonten,
- Sessions mit erwarteter `sessions.last_seen_at`-Abweichung,
- Token-, Projekt-, Launcher- und Creator-Daten,
- keine neuen Render-Schreibzugriffe seit Beginn des Stopps.

Der Abgleich muss protokollieren, welche Abweichungen erwartet sind. Ohne diesen
Nachweis kein Umschalten. PASS ist nur zulässig, wenn alle 26 Tabellen,
Zeilenanzahlen, Primärschlüssel-/Unique-Inventare, Token-, Projekt-, Launcher-
und Creator-Daten übereinstimmen und ausschließlich `sessions.last_seen_at`
als erwartete zeitabhängige Abweichung verbleibt.

## 5. Website-Abnahme nach dem Umschalten

Vor dem Entfernen des Wartungsmodus prüfen:

- `/api/health` und `/api/ready` liefern den erwarteten Neon-Status;
- `/api/integrations/status` gibt keine Geheimnisse aus und meldet die
  Konfiguration korrekt;
- Startseite, Login, Registrierung, Passwort-Recovery, E-Mail-Verifizierung
  und Kontoeinstellungen funktionieren;
- Admin-Navigation, `/api/admin/status`, Control Center und ein read-only
  Admin-Endpunkt sind mit dem Betreiberkonto erreichbar;
- ein authentifizierter Creator-Leseweg und genau ein kontrollierter Creator-
  Schreibweg funktionieren;
- Twitch-/TikTok-Callbacks, Launcher-Heartbeat und Job-Claiming werden nur
  nach Ende des Wartungsmodus erneut geprüft;
- TLS, Version/Commit und Render-Logs sind auf der Neon-Revision bestätigt.

Bei einem Fehler Wartungsmodus aktiv lassen. Keine produktiven Testdaten
erzeugen, wenn kein vorher freigegebener Testaccount und kein Cleanup-Pfad
vorhanden sind.

## 6. Rückfall ohne Datenverlust

- Solange der Wartungsmodus aktiv ist und Neon noch keine neuen Schreibzugriffe
  akzeptiert, kann die Anwendung auf Render zurückgestellt werden.
- Nach dem Öffnen von Schreibzugriffen auf Neon darf nicht blind auf Render
  zurückgeschaltet werden. Zuerst Neon sichern, Änderungen abgleichen und einen
  Reconciliation- oder Wiederherstellungsplan freigeben.
- Render und Neon niemals gleichzeitig als Schreibmaster betreiben.
- Bei Unsicherheit Wartungsmodus aktiv lassen und keine Datenbank zurücksetzen.

## Historische Statusnotizen

- Dump-/Restore-Skripte: vorbereitet, nicht ausgeführt.
- Wartungsmodus: lokal vorbereitet, nicht deployed.
- Unabhängige Sicherung: BLOCKED bis zur separaten Freigabe und geschützter
  Eingabe der Produktionszugangsdaten.
- Aktueller lokaler Lauf: BLOCKED, da Windows den BitLocker-/CIM-Statuszugriff
  verweigert; im Backup-Ordner liegt kein PostgreSQL-Dump und kein Manifest.
- Produktionsumschaltung: BLOCKED bis Backup, finalem Abgleich und Rollback-
  Freigabe.

### Historischer Status 2026-11-26

Die folgenden Ergebnisse ueberholen die historischen Vorbereitungsnotizen:

- Unabhaengige Neon-Sicherung: PASS; Dump, Manifest, SHA-256 und
  `pg_restore --list` wurden lokal geprueft.
- Isolierte Restore-Pruefung: BLOCKED bis zur interaktiven lokalen Eingabe der
  beiden Neon-Passwoerter. Die Ziel-Datenbank ist weiterhin leer und wurde
  nicht ueberschrieben.
- Produktionsumschaltung: BLOCKED; Schreibstopp, finaler Abgleich und
  Rollback bleiben nur vorbereitet.

### Tatsächliche Backup- und Restore-Validierung 2026-11-27

Die unabhängige lokale Neon-Sicherung wurde in der isolierten Zieldatenbank
vollständig wiederhergestellt und verglichen. Der vorhandene Dump wurde nicht
überschrieben. Die tatsächlichen lokalen Ergebnisse sind:

```text
archive_bytes=80839
sha256=d044bdc4956d46b414ee41815aff449ac0cc17b4ec0deb4168759d540afeeaf9
manifest=PASS
pg_restore_list=PASS toc_lines=160
target_before_tables=0
target_after_tables=26
tables=PASS count=26
data=PASS count=26
sequences=PASS count=2
indexes=PASS count=59
constraints=PASS count=229
restore_validation=PASS
```

Damit ist die unabhängige Backup- und Wiederherstellungsphase PASS. Der
abschließende Render-gegen-Neon-Abgleich während des Schreibstopps bleibt vor
der Umschaltung erforderlich; `sessions.last_seen_at` ist dabei als bekannte
zeitabhängige Abweichung gesondert zu dokumentieren.
