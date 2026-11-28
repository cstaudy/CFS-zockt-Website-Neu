# Datenbank-Migrationen

PostgreSQL ist die Datenbankbasis; Neon ist das vom Betreiber festgelegte Ziel.
Render-Laufzeitzuordnung, Backup/Restore und produktive Freigabe sind getrennte
Abnahmeschritte. Aktueller zentraler Plan: [Zentraler Entwicklungsplan (PR #107)](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/107). Keine produktive Ausführung
aufgrund dieses Dokuments allein.

## Normaler Migrationslauf

`001_initial.sql` aktiviert `pgcrypto`. `npm start` führt bei gesetzter
`DATABASE_URL` ausstehende Migrationen aus. Der Runner verlangt eine
lückenlose, aufsteigende Dateiliste ab 001 mit eindeutiger Nummerierung und
prüft diese vor dem ersten SQL-Zugriff. Ein Advisory Lock serialisiert
Migrationen. Das Ledger `schema_migrations` speichert Dateiname und SHA-256;
unbekannte Einträge, Lücken oder geänderte Prüfsummen blockieren weitere DDL.
Bereits ausgeführte Migrationen niemals umbenennen, überschreiben oder aus dem
Ledger entfernen.

## Historische Baseline 001–021

Eine bestehende Anwendung ohne Ledger darf nicht wie eine Neuinstallation
behandelt werden. Der manuelle Befehl `npm run migrate:baseline` erfordert
alle drei ausdrücklich bestätigten Schalter:

- `CONFIRM_MIGRATION_BASELINE=yes`
- `CONFIRM_VERIFIED_DATABASE_BACKUP=yes`
- `CONFIRM_LEGACY_BASELINE_ONLY=yes`

Der Befehl überprüft zuerst die historische Spalten-/Tabellenform lesend,
probt anschließend ausschließlich 001–021 in einer zurückgerollten
Transaktion und vergleicht Schema-Metadaten. Bei Abweichung erfolgt keine
Registrierung. Nur nach isolierter Restore-/Upgrade-Abnahme und eigener
Betreiberfreigabe darf eine produktive Baseline erfolgen. Die MFA-Migrationen
022–025 werden **nicht** als historisch ausgeführt eingetragen.

**Eine automatische Baseline beim Start ist verboten.**
`MIGRATION_BASELINE_ON_START=yes` führt in aktuellem main zum Abbruch.
Keine Produktionsverbindung für lokale Tests. Der
[Read-only Release-Preflight](../docs/operations/RELEASE_READINESS_READ_ONLY.md)
ist eine Prüfung und keine Freigabe.

## Geplante Auflösung der Nummernkollision (28.11.2026)

| Nummer | Status / Zuordnung |
| --- | --- |
| 001–025 | Main; historisches Präfix und SHA-256 unverändert erhalten |
| 026 | Passwort-Recovery, PR #103; bereits im isolierten Recovery-Validierungsbranch registriert, daher nicht umnummerieren |
| 027 | Vorgesehene neue Nummer für Launcher-Claim aus PR #50 (dort bisher 026) |
| 028 | Vorgesehene neue Nummer für Twitch EventSub aus PR #50 (dort bisher 027) |

Die letzten beiden Zuordnungen sind eine Integrationsentscheidung, **keine**
aktiven Migrationen. Lesende Neon-Prüfung: production und clean-validation
ohne Ledger, staging bis 025, recovery-validation bis 026 (Passwort-Recovery);
keine Launcher-Claim-/Twitch-Follow-Erweiterung in diesen vier Datenbanken.
Vor einer Umnummerierung zusätzlich alle relevanten Ziel-/Testumgebungen
prüfen und im aufgeteilten #50 die SQL-Dateien, Manifest, Schema-Flags, Tests
und Dokumentation konsistent anpassen. #103 bleibt in seinem bestehenden PR.
Keine neue 029+-Migration ohne Inventar und abgestimmte Abhängigkeiten.

Keine Zugangsdaten in GitHub, Chat oder Logs. Kein Deploy, produktives SQL
oder Rollback ohne separate Freigabe und nachgewiesenen Restore.
