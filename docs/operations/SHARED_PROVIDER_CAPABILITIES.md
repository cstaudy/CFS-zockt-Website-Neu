# Gemeinsame Plattformfähigkeiten – CORE-01 / PUB-01

Stand: 28.11.2026. Master: CFS-zockt-Website-Neu. Diese erste Entwicklungsstufe ist **rein lesend** und kein freigeschalteter Multi-Publisher.

## Wiederverwendung und Vertrag
- Bestehender authentifizierter GET `/api/creator/integration-capabilities` behält seine bisherigen OAuth-/Geräte-/OBS-Felder. Additiv: `integrations.platforms` und `platforms_status` (ok/unavailable).
- Ein parameterisierter SELECT aus den vorhandenen TikTok-/Twitch-Connection-Tabellen liest ausschließlich Provider, Scope und Ablaufdatum des angemeldeten Accounts. Keine neuen Tabellen, keine Token-/Profil-/E-Mail-Ausgabe, keine externen Provider-Aufrufe.
- Sieben Einträge: TikTok, Twitch, YouTube, Instagram, Facebook, Kick, Custom RTMP. OAuth nur für bereits implementierte Provider. „record_present“ ist kein Token-Validierungsnachweis; ein nicht abgelaufenes Datum bedeutet nicht, dass der Token gültig ist. Scope-Flags sind ausschließlich gespeicherte Metadaten. Bei Fehlern Status unavailable statt falscher Freigabe.
- `live.ready`, `publishing.ready` und `read.verified` bleiben in dieser Stufe false, auch bei vorhandenen Scopes. Das Modul ist keine Autorisierungsentscheidung. Künftige echte Aktionen müssen serverseitig Account, aktuelle Providerberechtigungen, App-Freigabe, Benutzerzustimmung und Laufzeit separat überprüfen.
- Bestehendes Integrations-Hub ergänzt um lesende Statuskarten. Keine neue Account-Verwaltung, keine Upload-Schaltflächen, keine Änderung an OAuth-Start/Callback, Stream-Studio-Limits oder Launcher.
- TikTok: derzeit gespeicherte Lesescopes; separate `video.upload` und `video.publish` als zukünftige Capability-Metadaten. Twitch: Stream-Key-Scope getrennt von Datei-Publishing. Weitere Provider bleiben geplant oder in CFS nicht unterstützt; keine Aussage, dass eine externe Plattform generell keine Funktion besitzt.

## Weitere Schritte (nicht implementiert)
1. Offizielle Developer-App-Freigaben und konkrete API-Produkte/Scopes pro Plattform prüfen. Keine Credentials im Repository.
2. Bestehende Provider- und Token-Lifecycle-Entwürfe in #50 abgleichen; keine zweite OAuth-Implementierung. Änderungen an Scopes erfordern ausdrücklich neue Zustimmung.
3. Gemeinsamer Account-Kontext für Stream Studio und spätere Publishing-Jobs; Ownership/Scope/Runtime-Gates, getrennte Ziele und Idempotenz serverseitig erzwingen.
4. Cut-Studio-/Mediathek-Übergabe und Multi-Publisher erst nach isoliertem Workflow-Vertrag. Noch kein tatsächlicher Upload, kein automatisches Posting.
5. #50 und #103 berühren server.js; #50 zusätzlich Integration-HTML/JS. Änderungen beim thematischen Split gezielt zusammenführen. #108/#109 nicht überschrieben, keine Migrationen berührt.

## Tests / Abnahme
Neue Capability-Tests sind in den bestehenden Provider-Configuration-Test eingebunden. Tests: Konto-Isolation auf Query-Vertragsebene, exakte Scope-Tokens, Ablaufstatus, unbekannte/duplizierte Metadaten, keine sensible Projektion, keine implizite Freigabe, Route- und UI-Vertrag. Vollständige CI sowie echte HTTP-/Browser-/Provider-Abnahme sind erforderlich; keine externe App-Abnahme aus CI ableiten. Rollback: PR nicht mergen oder alle zusammengehörigen Änderungen revertieren.
