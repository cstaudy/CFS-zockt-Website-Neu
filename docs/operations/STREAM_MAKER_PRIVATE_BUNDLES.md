# Stream Maker – private Bundle-Daten und Berechtigungsgrenzen

Diese Integration schaltet ausschließlich den **angemeldeten, privaten** Stream-Maker-Arbeitsbereich frei. Die bereits vorhandene Seite `/pages/stream-maker.html` kann eigene Bundles anlegen, speichern, kontrollieren, umbenennen, OBS-Quell-Token wechseln und archivieren.

Die Backend-API `/api/creator/stream-maker` erlaubt nur das aktuelle Creator-Konto. Konfigurationen werden anhand des vorhandenen Stream-Maker-Katalogs auf gültige Elemente, IDs, Größen, JSON-Grenzen und erlaubte Bildquellen bereinigt. Bundle-Erstellung serialisiert das Account-Limit mit PostgreSQL-Sperre. Bearbeitung, Rotation und Archivierung nutzen eine erwartete Projektversion; Steuereingaben werden während einer Transaktion atomar aktualisiert.

**Noch keine öffentliche Ausgabe:** Es gibt in diesem PR keine Route `/api/public/stream-maker/:token`, kein anonymes Bild-Hosting und keine Shop-Publikation. Die bereits in der Editoroberfläche angezeigte OBS-Adresse funktioniert daher bis zum separaten Folge-PR noch nicht. Ein gültiger Token alleine gibt in dieser Ausbaustufe keine privaten Daten frei. Der bestehende Stream-Maker-Shop bleibt deaktiviert.

Die allgemeinen `/api/creator/projects`- und Stream-Studio-CRUD-Routen dürfen Bundle-Datensätze mit `data.type=stream_maker` nicht erstellen, überschreiben oder archivieren. Sie bleiben für andere Creator-Projektarten erhalten. Keine Änderung an Admin-Rollen, MFA, Provider-Zugriff, Migration 026/027 oder Datenbankschema.

Die CI prüft reine Modellvalidierung sowie isolierte PostgreSQL-HTTP-Tests für Login, Eigentum, Versionen, ungültige Eingaben, generische Umgehungen, Steueraktion, Tokenrotation und Archivierung. Echte Browser-/OBS- und Render-Deploy-Abnahme sind gesondert erforderlich. Keine manuelle Produktionsdatenbank-Mutation.
