# Integrierte Creator-Abnahme – Auftrag 04

Basis: Codex-Staging `3f9bd3a220890946def60ebb19604d2a36a4beb0`. Vorheriger Audit #122 vollständig grün (Run 46128799229), aber noch nicht für diesen integrierten Commit. Dieser Folge-Audit ergänzt ausschließlich vorhandene HTTP-Tests und Dokumentation. Kein Anwendungs-/Designcode, kein Merge/Deploy.

## Testlücken geschlossen (Ausführung ausstehend)
Aus #119 und #121 selektiv in den vorhandenen PG18-HTTP-Test übernommen: Setup-Authentifizierung/Validierung, reservierter Namespace, parallele Versionskonflikte, allgemeine Settings gleichzeitig mit Setup-Save, Konto-Isolation; exakter Claim-Device, zweites aktives Gerät desselben Kontos, konkurrierende Claims, historische ungebundene Claims und fremder Jobtyp. Der neue Auth-Concurrency-Test aus Codex bleibt erhalten. CI nutzt vorhandenen PostgreSQL-18-Service, ausschließlich synthetische Daten. Keine reale Geräte-, Browser- oder Provider-Abnahme.

## Migration 026 – exakter read-only Befund
Neon-Recovery-Ledger (ein Eintrag) enthält SHA-256 `58f7d968386934ab145db5636400ba8476d9ca57ffe14a8126e721d46ae6ad07`. Ursprüngliche Datei aus #103 in LF ergibt `8890594f2b249a6e9e64e4142d0a03fba72ffe92179c79462aff684dfbbd5e2c`; dieselbe Datei vollständig in CRLF mit finalem Zeilenende ergibt exakt den Ledger-Hash. Staging-Datei `86032e512e9390fc256822e3c627048aab78308d6eeb6e542182f19e055202ba` passt nicht. Katalog bestätigt alte Indexnamen password_recovery_attempt_account_idx / password_recovery_attempt_ip_idx. Das ist kein reines Zeilenendenproblem der aktuellen Datei, weil auch SQL-Indexnamen und Kommentare abweichen. Vor einer Freigabe alle relevanten Ledger und Schemaformen inventarisieren, ursprüngliche SQL-Identität/Dateibytes und checkoutunabhängige Reproduzierbarkeit sicherstellen; getestete separate Upgrade-Strategie bei tatsächlich verschiedenen angewandten Varianten. Kein pauschales Hash-Normalisieren, kein Ledger-Update und kein Umschreiben einer angewandten Migration ohne verifizierten Plan. Kein produktives SQL ausgeführt.

## Nächste Reihenfolge
1. Integrierte CI und neue E2E-Fälle auswerten; fehlgeschlagene Tests korrigieren, ohne sie abzuschalten.
2. Migration 026 als Release-Blocker auflösen; realer unabhängiger Backup-/Restore- und Betreiber-/MFA-Nachweis bleiben eigene Gates.
3. Authentifizierte Browserabnahme auf lokaler isolierter PG18-DB mit synthetischen Konten. Vorhandene Designreferenzen und Markenassets erhalten.
4. Launcher-Desktop-/OBS-Bestand aus #50 und älteren Referenzen gezielt inventarisieren; individuelle Geräteauthentifizierung, lokale Engine, kompatible Installation. Multi-Publisher bleibt pausiert. Haushaltsapp und CFScord unberührt.
