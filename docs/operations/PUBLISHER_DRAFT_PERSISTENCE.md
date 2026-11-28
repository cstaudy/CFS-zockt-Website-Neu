# Multi-Publisher: dauerhafte Entwürfe (isolierter PostgreSQL-Prototyp)

Stand 28.11.2026, PUB-03. Folge zu #113 (#110 → #111 → #113).
**Kein produktiver Auftragsspeicher und keine Veröffentlichungsfreigabe.**
Kein HTTP-Endpunkt, Worker, Upload, Rendering, Scheduling oder neue OAuth-Rechte.

## Speicherung und Sicherheitsgrenzen

- `src/publisher-draft-store.js` nutzt vorhandene Vorschauvalidierung und den bestehenden Request-/Ziel-Key-Vertrag. Konto-ID muss bei späterer Integration aus der authentifizierten Session stammen. Keine externe URL, kein Token, kein Dateipfad, keine Client-Account-ID im Nutzpayload.
- PostgreSQL-Transaktion: Account-Zeile sperren, Medienbesitz und Typ/Größe in bestehender Mediathek prüfen (Media-Zeilenlock), Request/Fingerprint vergleichen. Neue Entwürfe samt allen Zielzeilen atomar schreiben. Identische Wiederholung liefert denselben Entwurf, geänderte Absicht unter gleicher Kennung liefert 409. Fehlende/inkonsistente Zielzeilen nicht still reparieren.
- Unique Constraints für Account/Request und Ziel; zusammengesetzter Fremdschlüssel bindet Zielzeilen an den Eigentümer des Entwurfs. FK auf bestehendes Konto. Keine zweite Mediathek oder neue Account-Tabelle im Anwendungsschema. Limit vorläufig 50 Entwürfe pro Account (Entwicklungsentscheidung, kein Tarif). Kein automatisches Entfernen von Aufträgen.
- Absichtlich kein FK auf user_media: vorhandene Medienlöschung soll nicht blockiert und spätere Idempotenz-Historie nicht durch Cascade entfernt werden. Ein später gelöschtes Medium macht den Entwurf ungültig; jede erneute Benutzung muss Medienbesitz/Existenz prüfen. Vor echter Freigabe unveränderliche gerenderte Variante, Content-Hash, tatsächliche Provider-Identität und Zustimmung binden; Datenlöschung/Aufbewahrung und Tombstones separat abnehmen.
- Zielzustand ausschließlich draft, Revision/Versuche 0 (auch SQL CHECK). Noch keine persistierten Worker-Übergänge, CAS/Lease/Outbox, Provider-Statusabfrage oder externe Veröffentlichung. Der Zustand aus #113 darf erst nach vollständiger Freigabe und dauerhaftem Statusvertrag erweitert werden.
- `scripts/fixtures/publisher-draft-schema.sql` ist eine **unregistrierte Testfixture**, keine Migration. Keine Nummer 029+ reserviert. Vor produktivem Schema die noch offenen Migrationen 026–028 und alle relevanten Branches/Zieldatenbanken prüfen. Keine Änderung an bestehendem Migrationsmanifest, Cut-Export-Queue, Launcher oder Render.

## Reale isolierte CI

`scripts/test-publisher-draft-pg18.mjs` verweigert jede andere URL als die ausdrücklich erlaubte disposable localhost-CI-URL und verlangt den bestehenden CI-Opt-in. Erstellt ein zufällig benanntes Schema, prüft den Suchpfad, nutzt ausschließlich synthetische Konto-/Medienzeilen und räumt nur dieses Schema auf. Keine Neon-Verbindung. Tests: parallele identische Requests, geänderte Absicht, Cross-Account, fremder Medienbesitz, ungültiger MIME, erzwungener Zielinsert-Fehler mit Rollback, SQL-Draft-Guard, FK, Quota und gelöschtes Medium. Wiederverwendet den vorhandenen PostgreSQL-18-CI-Service (kein neuer Dienst). CI für diesen PR muss noch bestätigt werden.

## Weiterer Ablauf

1. Isolierte CI und Schema-/Privacy-Review; #103 berührt check.yml, beim Merge beide Testschritte erhalten. #110/#111/#113 zuerst integrieren, #112/#114 Provider-Testimports konsolidieren.
2. Cut-Studio-Handoff und unveränderliche Ausgabevarianten: überprüfte Bytes/Format, Content-Hash, Besitz, Aufbewahrung, Subtitle-/Branding-Renderparameter. Keine neue parallele Cut-Implementierung.
3. Vollständigen produktiven Schemaentwurf inklusive CAS/Lease/Attempt-Historie, Reconciliation, Limits, Cleanup, Retention und expliziter Freigabe nach geprüfter Migration vorbereiten. Echte externe Developer-App-Freigaben und Benutzerzustimmung separat.
4. Erst nach isolierter Migration/Restore-Abnahme und eigener Betreiberfreigabe darf der produktive Schemaentwurf ausgeführt werden. Rollback dieses Prototyps: Folge-PR nicht mergen. Keine Produktionsdaten oder Konfiguration verändert.
