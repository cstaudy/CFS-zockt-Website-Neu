# Übergabe – Video-/Clip-Upload-Limit verbindlich prüfen

**Stand 16.11.2026.** Basis: nicht gemergter [PR #95](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/95), Commit `833123efd17e419263d0ce230320d71b62cfa948`. Folgebranch: `fix/media-upload-item-quota-2026-11-16`. **Keine Produktionsaktion.**

## Befund

`GET /api/creator/media/videos` und `GET /api/creator/media/clips` geben bereits `limits.max_items: 500` zurück. `uploadUserMedia()` registrierte aber neue `user_media`-Zeilen ohne Zählprüfung. Damit konnte ein Konto über die beworbene Grenze hinaus Videos/Clips registrieren. Der Befund betrifft die serverseitige Quota-Prüfung; es wird kein beobachteter Missbrauch behauptet.

## Umsetzung

- `src/media-quota.js`: Zählt innerhalb einer Transaktion die Zeilen des jeweiligen Kontos **und Ordners**. Die bereits vorhandene `accounts`-Zeile wird über `FOR UPDATE` gesperrt; parallele POSTs desselben Kontos können den letzten freien Slot nicht gleichzeitig belegen. Der erste belegte Slot bei 499 Einträgen ist erlaubt, ab 500 wird `402 MEDIA_LIMIT_REACHED` zurückgegeben.
- Die Grenzen in der Listen-API stammen aus derselben Konstante. `videos` und `clips` bleiben unabhängig: je 500 Metadatensätze. Keine bytebasierte Gesamtspeicherzusage, keine Änderung der bestehenden 16-MiB-Einzeluploadgrenze.
- Unerwartete/fehlende Datenbank-Zählerwerte werden **nicht** als freier Slot behandelt. Ungültige Bytezahlen und Ordner werden vor der Transaktion abgewiesen.
- `storeUploadWithRecord()` entfernt auf Quota-Ablehnung nur die in diesem Aufruf neu angelegten Upload-Bytes. Seine bisherigen Kollisions- und Datenbankfehler-Sicherheitsgrenzen bleiben bestehen.
- `scripts/test-media-quota.mjs`: Zählgrenzen, ungültige PostgreSQL-Rückgaben, Owner-Lock, COMMIT/ROLLBACK, Fehlerfälle und Dateibereinigung.
- `scripts/test-account-creator-flow.mjs`: echte HTTP-POST-Konkurrenz bei 499 Clips gegen **ausschließlich lokalen Wegwerf-PostgreSQL-18-Testserver**; genau ein 201 und ein 402; Prüfung auf verwaiste Dateien; andere Medienordner bleiben benutzbar. Alle bewusst eingefügten Fixtures werden in `finally` bereinigt.

## Abnahme / Nachweise

`npm run check` und die vollständige GitHub-Actions-CI einschließlich PostgreSQL 18, Legacy-Migration und isoliertem Restore müssen auf dem **finalen Folge-PR-HEAD** grün sein. Ein erfolgreicher Lauf von PR #95 darf nicht als Erfolgsnachweis für den neuen Branch verwendet werden. **Code-/Test-HEAD `da4888908dd9c089ae2c14fe06d2b59ad5db6c27`: vollständige [GitHub-CI 43780335660](https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43780335660) `success`, einschließlich `npm run check`, echter HTTP-/PostgreSQL-18-Konkurrenztests und isoliertem Restore.** Nachfolgende Dokumentations-Commits benötigen erneut einen grünen CI-Nachweis auf ihrem finalen HEAD.

## Risiko, Grenzen und Rücknahme

Eine bislang technisch mögliche Überschreitung über 500 Medien pro Ordner wird bei weiteren Uploads jetzt abgewiesen. Vorhandene Medien bleiben erhalten, Listen und DELETE funktionieren weiterhin. Bei DB-Störung schlägt die Registrierung fehl, nicht die bereits bestehende Datei-Löschlogik. Rücknahme durch Revert des Folge-PRs.

**Keine** Render-/Produktionsdatenbank-Verbindung, Migration, Deployment, Merge, Secret-Änderung, kostenpflichtige Ressource oder Betreiberentscheidung. Die dringend ausstehende echte Datensicherung bleibt separat in [P0-Issue #93](https://github.com/cstaudy/CFS-zockt-Website-Neu/issues/93) gesperrt. Zuerst muss PR #95 separat geprüft und ausdrücklich zum Merge freigegeben werden; ein anschließender Folge-PR benötigt ebenfalls eigene Freigabe.
