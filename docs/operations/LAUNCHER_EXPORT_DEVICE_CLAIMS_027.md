# Launcher-Exportaufträge: exakte Gerätebindung (Entwurf)

Stand 28.11.2026, CORE-01. Selektive Übernahme der Claim-Spalte aus #50 auf dem aktuellen Recovery-/Admin-Zweig #103 → #117, statt des großen Alt-PRs. Neuer separater PR; keine zweite Job-Queue.

## Befund und Migration
Read-only Neon-Abfrage von Produktion, Staging und Recovery: claimed_by_device fehlt in allen drei; jeweils 0 Aufträge mit Status claimed/processing. Momentaufnahme, vor späterer Migration erneut prüfen. 026_password_recovery_rate_limit.sql bleibt unverändert; neue 027_launcher_job_claims.sql im Manifest dieses Entwurfs. Historische 001–021 unverändert, nächste EventSub-Nummer 028 nur nach eigener Prüfung. Alte #50-Migration 026 nicht zusätzlich übernehmen.

Die additive Spalte referenziert vorhandene launcher_devices, Index für Claim-Status. Bestehende Daten und Job-IDs bleiben erhalten. Kein automatisches Requeue/Backfill: ein historischer Claim ohne Geräte-ID kann von keinem Launcher übernommen oder aktualisiert werden. Claimed-Auftrag kann der Eigentümer wie bisher abbrechen; processing benötigt gesonderte autorisierte operative Klärung. Vor Rollout Launcher/Queue anhalten, laufende Aufträge abarbeiten, auf 0 claimed/processing prüfen; kein pauschaler Datenfix. Bei gelöschtem Gerät bleibt der Job ohne Claim-ID, fail closed.

## Auftragsschutz
Claim in vorhandener Transaktion mit aktiver Gerätezeilen-Sperre und FOR UPDATE SKIP LOCKED, speichert account_id-gebundene Geräte-ID. Update verlangt denselben aktiven Claim-Device, Konto, Jobtyp cut_export und erlaubte Zustände; Gerätezeilensperre bleibt bis Commit erhalten. Anders als #50 keine Lockerung der Jobtypfilter und kein Freigeben der Sperre vor dem Update. Keine Änderung an API-Routen, Launcher-Headern oder Queue-Limits.

**Grenze:** Geräte-ID ist kein kryptografischer Identitätsnachweis. Der vorhandene gemeinsame Bridge-Secret plus Geräte-ID bleibt der Authentifizierungsvertrag. Schutz gegen Identitätsvortäuschung mit gestohlenem gemeinsamen Secret/Device-ID erfordert individuelle Geräteschlüssel, sichere Pairing-/Rotation-/Widerruf-Regeln und Client-Abnahme. Kein Anspruch auf vollständige Geräteauthentifizierung, keine automatische Wiederaufnahme verwaister Jobs, keine neuen Publish-Jobs.

## Test und Integration
Bestehender isolierter PostgreSQL-HTTP-Test erweitert: zweites aktives Gerät desselben Accounts abweisen, fremdes Konto abweisen, Claim-Spalte prüfen, konkurrierende Claims genau einmal, Non-Export-Job nicht claimen, ungebundene Alt-Claims ablehnen. Vorhandene Revocation- und Zustandsprüfungen bleiben. Legacy-Baseline, inkrementelle Upgrade-/Dump-Restore-Tests, verschlüsselte Backup-Rehearsal und Read-only Release-Preflight auf 027 angepasst. Schema-Readiness blockiert bei fehlender Claim-Spalte, selbst mit vollständigem Ledger. CI dieses PR noch offen; echte Windows-/OBS-Geräteprüfung offen.

#117 als Base erhält Recovery-Migration 026 und Admin-Regel. #120 berührt src/tool-jobs.js (zentrales MAX_PENDING); bei Konsolidierung dessen Import erhalten. #109 Manifest-Guard, #108 Preflight/TLS, #50, #119 HTTP-E2E-Test, #117 Admin-Blocker beachten. Keine blind gemergten Alt-PRs. Produktionsfreigabe erst nach verifiziertem vollständigem Restore, Ziel-/Ledgerprüfung, Betreiber-/MFA-Abnahme, Drain, kompatiblem Launcher und ausdrücklicher Freigabe. Kein produktiver SQL-Schreibzugriff, keine Migration oder Render-Änderung ausgeführt. Rollback vor Freigabe: PR nicht mergen; nach Migration keine unsichere alte Claim-Logik reaktivieren.
