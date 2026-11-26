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

Fuer die vollstaendige Restore-Pruefung fragt das Skript danach die Render-
Quelle read-only ab und vergleicht Tabelleninventar, Zeilenanzahl und einen
deterministischen Inhaltsfingerabdruck jeder der 26 Tabellen.

## 3. Kontrollierter Schreibstopp

Die Produktions-Branch enthält dafür den fail-closed Schalter
`CFS_MAINTENANCE_MODE=true`. In diesem Modus bleiben nur Health-, Readiness-,
Integrations- und öffentlicher Status-Endpunkt erreichbar; alle anderen API-
Pfade, einschließlich ungewöhnlicher schreibender GET-Pfade, liefern HTTP 503.
Statische Seiten bleiben auslieferbar.

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
5. Erst danach `DATABASE_URL` auf Neon setzen und `DATABASE_SSL=true` prüfen.
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
Nachweis kein Umschalten.

## 5. Rückfall ohne Datenverlust

- Solange der Wartungsmodus aktiv ist und Neon noch keine neuen Schreibzugriffe
  akzeptiert, kann die Anwendung auf Render zurückgestellt werden.
- Nach dem Öffnen von Schreibzugriffen auf Neon darf nicht blind auf Render
  zurückgeschaltet werden. Zuerst Neon sichern, Änderungen abgleichen und einen
  Reconciliation- oder Wiederherstellungsplan freigeben.
- Render und Neon niemals gleichzeitig als Schreibmaster betreiben.
- Bei Unsicherheit Wartungsmodus aktiv lassen und keine Datenbank zurücksetzen.

## Status dieser Vorbereitung

- Dump-/Restore-Skripte: vorbereitet, nicht ausgeführt.
- Wartungsmodus: lokal vorbereitet, nicht deployed.
- Unabhängige Sicherung: BLOCKED bis zur separaten Freigabe und geschützter
  Eingabe der Produktionszugangsdaten.
- Aktueller lokaler Lauf: BLOCKED, da Windows den BitLocker-/CIM-Statuszugriff
  verweigert; im Backup-Ordner liegt kein PostgreSQL-Dump und kein Manifest.
- Produktionsumschaltung: BLOCKED bis Backup, finalem Abgleich und Rollback-
  Freigabe.
