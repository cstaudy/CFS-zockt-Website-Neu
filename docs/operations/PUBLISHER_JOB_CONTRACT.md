# Multi-Publisher: Zielaufträge und Idempotenz (Vertragsprototyp)

Stand 28.11.2026. PUB-03, aufbauend auf PR #111 und #110.
Dieser Baustein ist **nicht** mit HTTP-Routen, Datenbank, Launcher oder Provider verbunden. Er kann keine Veröffentlichung auslösen. Keine neuen Tabellen, Scopes, Hintergrundjobs oder Infrastruktur.

## Vertrag

- Vorhandenen Vorschau-Validator wiederverwenden; nur bekannte Zielprofile und normalisierte Nutzereingaben zulassen. Konto-ID muss später ausschließlich aus der authentifizierten Server-Session stammen.
- Ein serverseitig abgeleiteter, kontogebundener Request-Key pro explizitem Veröffentlichungswunsch; eigener stabiler Key je Ziel. Gleicher Request und gleicher normalisierter Inhalt sind dieselbe Absicht; gleicher Request mit geändertem Inhalt ist Konflikt. Reihenfolge der Zielauswahl ändert die Identität nicht. Bewusst erneute Veröffentlichung erfordert einen neuen Request.
- Payload-Fingerprint enthält die normalisierten Vorschau-Eingaben, nicht den Nachweis eines gerenderten Medieninhalts. Vor Persistierung/Autorisierung zusätzlich eine unveränderliche, geprüfte Variante und deren Hash, Account-/Zielidentität sowie aktuelle freigegebene Einstellungen binden. Kein Vertrauen in Browser-Metadaten.
- Eigener Zustand je Plattform: draft → queued → preparing → submitting → submitted → published. Abweichungen: retryable, reconcile_required, failed, canceled. Revision und Attempt-ID schützen gegen veraltete Übergänge auf Vertragsebene. Maximal drei Versuche im Prototyp; konkrete Provider-Rate-Limits und Backoff gesondert prüfen.
- Nach unklarem Ergebnis (z. B. Timeout nach Übertragung) **keine erneute Übertragung**, bis vertrauenswürdige externe Statusprüfung die Nichtanlage bestätigt. Wenn der Provider keinen solchen Nachweis erlaubt, bleibt der Auftrag zur manuellen Klärung blockiert. Accepted ist nicht published. Ein fehlgeschlagener bereits angenommener Auftrag wird nicht automatisch erneut veröffentlicht.
- Cancellation vor Übertragung möglich; nach Übertragungsbeginn keine falsche Erfolgsmeldung zur Stornierung. Andere Ziele bleiben unberührt. Keine automatischen externen Löschaktionen.

## Notwendige nächste Integrationsschritte

1. Persistenz in eigenem Publishing-Lifecycle, nicht den bestehenden cut_export-Claim erweitern. Vor Schemaentwurf die reservierten Migrationen 026–028, #50/#103 und aktuellen main abgleichen. Keine Nummer ohne vollständiges Inventar reservieren.
2. Unique Constraint für account/request und Ziel-Key; atomarer Vergleich des Fingerprints; Revision als Compare-and-Swap; Lease/Fencing, Transaktion/Outbox und durable Übergänge. Attempt-ID muss serverseitig neu erzeugt werden und darf nicht wiederverwendet werden. Keine externe Anfrage vor dauerhaftem submitting-Zustand; Crash-Recovery von submitting stets über Reconciliation, nie blind retryen.
3. Autorisierung mit tatsächlichem Medienbesitz, geprüfter Variante, konkretem verbundenem Account, Provider-App-Freigabe, aktuellen Scopes/Token, Privacy-/Interaktionsoptionen und ausdrücklicher Nutzerzustimmung. Nur vertrauenswürdige interne Adapter dürfen authorize, provider_accepted, provider_confirmed_absent oder provider_published erzeugen. Der reine Reducer beweist diese Voraussetzungen **nicht**.
4. Sichere Token-Erneuerung/Revocation, Provider-spezifische Statusabfrage, Rate Limits, sichere Fehlercodes, Quota, temporäre Medienaufbewahrung und Löschregeln. Kein Upload bei fehlenden Freigaben. Scheduling später separat.
5. Tests auf realem isoliertem PostgreSQL: parallele identische und abweichende Requests, Cross-Account-Isolation, Worker-Lease/Crash/Retry, Provider-Timeout vor/nach Annahme, explizite Nutzerzustimmung, Reconnect/Widerruf, Mock-Provider, dann echte genehmigte Testaccounts.

## Abnahmegrenze

Reine Unit-Tests für Request-Key/Fingerprint, Zielisolation, veraltete Revision, Attempt-ID, unklare Ergebnisse, zulässige Zustandsübergänge und Retry-Grenze. Eingebunden in bestehende Provider-CI; noch kein persistierter Job oder wirksamer Doppelpostschutz in Produktion. Rollback: Folge-PR nicht mergen. PR #110 und #111 zuerst integrieren; #112 teilt das Provider-Testskript, beim Merge alle Imports erhalten. Keine Änderung der produktiven Datenbank oder Render-Konfiguration.
