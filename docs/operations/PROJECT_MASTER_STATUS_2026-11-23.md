# CFS-Zockt – Master-Status Phase 1

**Datum:** 23.11.2026  
**Repository-Stand:** `main` `7808447a26fc51d906e97bfc81d7cae4baed83cd`  
**Prüfung:** ausschließlich lesend; keine Migration, keine Umstellung von `DATABASE_URL`, kein Deploy, keine Abschaltung von Render.

## Neon-Bestandsaufnahme

Die Neon-Organisation ist ein kostenloser Workspace (`cstaudygaming@gmail.com`). Es wurden drei Projekte und deren Branches/DB-Metadaten gelesen:

| Projekt | Branch-Zustand | Datenbankbefund | Bewertung |
|---|---|---|---|
| `cfs-zockt-render-migration` | `production` bereit, `staging-isolated-test` bereit; beide ungeschützt | Produktion: 26 Tabellen, 2 Sequenzen, 59 Indizes, 229 Constraints, 2 Extensions, **kein** `schema_migrations`; Staging: 28 Tabellen, 2 Sequenzen, 63 Indizes, 242 Constraints, 2 Extensions, `schema_migrations` mit 25 Einträgen | Import und Staging-Migration sind erkennbar, aber Produktionsbranch und Staging sind nicht schemaidentisch |
| `cfs-zockt` | einziger `production`-Branch bereit | 79 Tabellen, 5 Sequenzen, 193 Indizes, 866 Constraints, 2 Extensions, kein `schema_migrations` | Separates älteres/anderes Projekt; nicht automatisch als Quelle oder Ziel annehmen |
| `cfs-zockt-recovery` | `production` archiviert | Keine aktive Zielumgebung | Nicht als betriebsbereites Recovery-Ziel bewerten |

Der Produktionsbranch des Migrationsprojekts enthält eine Datenbank `cfs_zockt_render_import`; der Staging-Branch verwendet eine gleichnamige, getrennte Datenbank. Die Staging-Datenbank listet exakt die Migrationen `001_initial.sql` bis `025_mfa_challenge_issuance_limit.sql` mit Checksums. Der Produktionsbranch hat dagegen die importierten 26 Tabellen ohne Migrationshistorie.

### Aggregierte Plausibilitätsprüfung

Es wurden nur nicht-personenbezogene Zählwerte abgefragt. In beiden Branches existiert ein Konto; Creator-Projekte, Creator-Assets, Medien, Launcher-Geräte, Twitch-/TikTok-Verknüpfungen und Tool-Jobs sind leer. Sessions zählen 2 im Produktionsbranch und 1 im Staging-Branch. Das beweist weder Datenvollständigkeit noch korrekte Kontoinhalte; es zeigt eine konkrete Abweichung, die vor einer Umschaltung geklärt werden muss.

### Neon-Entscheidung

**Status: BLOCKIERT / nicht produktiv freigegeben.**

Vor einer Umstellung müssen Betreiber und Repository eindeutig festlegen:

1. welches der drei Projekte das verbindliche Ziel ist;
2. ob `cfs-zockt-render-migration/production` nur ein Rohimport oder bereits die aktive Datenbank ist;
3. warum die Produktionskopie keine Migrationshistorie besitzt, während Staging 25 Migrationen kennt;
4. ob Staging absichtlich weiterentwickelt wurde und wie die Session-Abweichung entstand;
5. welche Render-Variablen (Name/Host nur intern, niemals im Repo) aktuell von der Anwendung verwendet werden.

Die App liest weiterhin ausschließlich `process.env.DATABASE_URL`. Im Repository gibt es keinen Beleg, dass Render bereits auf Neon zeigt. `.env.example`, Render-Dokumentation und Workflows nennen weiterhin Render als Laufzeitquelle; eine produktive Umschaltung wurde nicht vorgenommen.

### Sicherer nächster DB-Schritt

Auf dem vorhandenen isolierten Branch darf ein rein lesender Schema-/Katalogvergleich fortgesetzt werden. Eine neue Neon-Kopie, Migration, Rollenänderung, IP-Allowlist-Änderung oder Änderung von Umgebungsvariablen benötigt eine ausdrückliche Betreiberfreigabe. Für Migrationstests ist der direkte (nicht gepoolte) Neon-Anschluss zu verwenden; die Anwendung soll den gepoolten Anschluss nutzen, sobald das Ziel bestätigt ist.

## Funktions-/Studio-Status aus dem Repository

Die lokalen Vertrags- und Renderer-Tests decken öffentliche Projektionen, Upload-/Quota-Regeln, Widget-/Scene-/Stream-/Cut-Studio-Ausgaben, PlayStation-Validierung, Twitch-Provider und Admin-/Release-Guards ab. Sie beweisen keine produktive Provider-Verbindung, OBS-Desktop-Steuerung, Launcher-Download-Installation, Payment-Abwicklung oder echte Neon-/Render-Laufzeit.

| Bereich | Quelllage | Phase-1-Einstufung |
|---|---|---|
| Launcher | UI, Auth-Routen, Geräte-/Job-Schema vorhanden | teilweise implementiert; Downloads, Hintergrundjobs und Plattformgrenzen noch nicht Ende-zu-Ende abgenommen |
| Creator Studio | Projekt-/Asset-/Settings-Module und Dashboard vorhanden | Kern vorhanden; reale DB- und Upload-Persistenz unbestätigt |
| Stream Studio / OBS | Studio-UI, Adapter, EventSub- und Provider-Code vorhanden | teilweise implementiert; OBS-Desktop- und Live-Akzeptanz offen |
| Widget / Scene | sichere Renderer und öffentliche Projektionstests vorhanden | lokal belastbar; echte Persistenz/Publikation noch mit Staging abnehmen |
| Cut Studio / Stream Maker / Universal Builder | Module und Vertragsprüfungen vorhanden | Kern vorhanden; Export-/Job-Lifecycle Ende-zu-Ende offen |
| Twitch / TikTok / PlayStation | Provider- und Validierungscode vorhanden | Credentials, Redirects und echte externe Antworten ungetestet |

## Priorisierte Phase-1-Roadmap

- **P0:** Neon-Ziel und Branch-Rollen klären; Rohimport gegen Staging-Migrationen erklären; sichere Backup-/Restore-Bereitschaft herstellen.
- **P1:** Nur einen rebasierten MFA-Stack und eine Admin-Variante weiterverfolgen; Launcher/Studios in kleine Abnahme-PRs schneiden; Render- und Neon-Variablenfluss dokumentieren.
- **P2:** Testharness unter Linux/WSL und Windows portabel machen; Accessibility-/Responsive-Screenshots und Core-Web-Vitals-Baseline ergänzen.

## Betreiberentscheidungen vor Phase 2

1. Welches Neon-Projekt ist das verbindliche Ziel: `cfs-zockt-render-migration`, `cfs-zockt` oder ein anderes?
2. Darf für ein rein synthetisches/isoliertes Testfenster eine Neon-Branch verwendet werden, oder soll nur die vorhandene Staging-Branch gelesen werden?
3. Welche Designrichtung soll nach dem Vorschlag in `docs/design/CFS_DESIGN_DIRECTIONS_2026-11-23.md` umgesetzt werden?
4. Soll Render bis zum vollständigen Neon- und Restore-Nachweis unverändert aktiv bleiben? (Empfehlung: ja.)

