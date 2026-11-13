# Unmerged-Code-Audit – CFS-zockt-Website-Neu

**Stand: 13. November 2026.** Quelle: GitHub-PR-Metadaten, alle über
`search_branches` sichtbaren Branches, Git-Vergleiche gegen `main`,
geänderte PR-Dateien, ausgewählte Originalpatches und die aktuellen
Quelldateien. **Keine Produktionsdatenbank wurde gelesen oder geändert.**
Kein Merge, Deploy, Branch-Löschen oder automatisches Schließen von PRs.

## Ergebnis und Freigabe

**Nicht pauschal mergen.** Die 14 offenen PRs haben unterschiedliche
Baselines, mehrere überschneiden sich in `server.js`, `src/auth.js`,
`src/projects.js` und `index.html`, andere sind gestapelte historische
Zwischenschritte. Aktuell sind 49 Branches sichtbar. Die Bestandsaufnahme
hat die Diff-/Ancestry-Lage **aller 47 anderen Branches** relativ zu
`main` geprüft; dies ersetzt **keine vollständige Zeile-für-Zeile-
Begutachtung jedes Commits oder echte Hardware-/Produktionsabnahme**.

GitHub meldet PR #50 als konfliktfrei (`mergeable=true`). Der PR ist
264 Commits vor dem aktuellen `main`, 0 Commits dahinter und umfasst
beim Audit 84 geänderte Dateien. Der zuletzt beobachtete vollständige
CI-Lauf #337 ist grün. **Konfliktfrei und grüne CI sind keine
Produktionsfreigabe.** PR #50 bleibt Draft. Für keinen der 14 PRs
wurden eingereichte menschliche Reviews oder Inline-Reviewthreads
gefunden.

### Kritische Blocker

1. **Adminrechte und Zugangsrisiko – P0.** Der aktuelle `main` und
   PR #50 weisen Adminrechte noch allein anhand einer fest definierten
   Betreiber-E-Mail zu (u. a. `src/projects.js:requireAdmin` und
   `src/auth.js`). PR #47 prüft zusätzlich eine explizite DB-Rolle
   `admin` und `email_verified_at`. Das behebt die schwächere
   Autorisierung, ist aber laut GitHub im aktuellen Zustand **nicht
   konfliktfrei mergebar**. Der historische PR-Text warnt zudem, dass
   ein Umstieg ohne verifizierte Betreiberrolle den Admin aussperren
   könnte. Diese historische Kontoprüfung ist **keine aktuelle
   Produktionsbestätigung**. Deshalb weder den bestehenden
   Berechtigungsstand als sicher freigeben noch #47 ohne vorbereiteten,
   autorisierten Betreiber-Preflight und geprüfte Backups ausrollen.
   PR #26 ist die ältere, gegenüber heutiger MFA veraltete Variante.
2. **Gesamtumfang PR #50 – P1.** Titel und ursprüngliche Beschreibung
   behaupten noch „nur Dokumentation“; tatsächlich enthält PR #50
   umfangreiche Backend-Routen, zwei Migrationen (026 und 027),
   private Creator-Datenhaltung, OBS-Ausgaben, Live-Provider, Launcher
   und Medien. Ohne thematische Review, Migrations-/Rollbackplan und
   echte OBS-/Twitch-/Launcher-Abnahme darf dieser große PR nicht
   als fertiger Dokumentationswechsel gemergt werden.
3. **Design-/Layout-Altstände – P1.** PRs #10, #11, #12 sind seit dem
   älteren `main`-Stand divergiert und GitHub meldet für alle
   `mergeable=false`. #12 überschreibt zentrale globale
   `assets/css/styles.css`-Regeln; #11 und #10 bearbeiten
   `index.html`/Creator-Seiten. Ein pauschaler Merge kann das
   inzwischen gültige Layout überschreiben. Gewünschte visuelle
   Eigenschaften ausschließlich gezielt gegen das aktuelle
   Designsystem übertragen, nach Screenshot- und Mobilabnahme.
4. **Legacy-/Produktionsmigration – P0.** Die grüne isolierte
   PostgreSQL-18-Testumgebung und CI-Backup-/Restore-Probe sind **kein
   Backup der produktiven Render-Datenbank**. Produktionsbackup,
   gesicherter Restore-Klon, Adminrolle, E-Mail-Verifizierung,
   Migrationen 026/027, OAuth-/Twitch-EventSub-Secrets und Rollback
   brauchen getrennte autorisierte Freigabe.

## Alle 14 offenen PRs (zum Prüfzeitpunkt)

| PR | Bereich | GitHub mergeable | Befund / Behandlung |
| --- | --- | --- | --- |
| [#50](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/50) | Aktuelle Creator-/Modernisierungsserie | ja, Draft | 264 Commits, 84 Dateien, CI #337 grün. **Nicht mergen**; großes Release-Bundle, kein Admin-Rollout. |
| [#47](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/47) | Bestätigte Adminrolle mit aktuellem MFA | nein, Draft | Sicherheitsgewinn, aber Admin-Lockout- und Konfliktrisiko; separat freigeben und konfliktfrei integrieren. |
| [#43](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/43) | MFA-Lock-Reihenfolge | ja, gestapelt | `src/mfa-login.js` am PR-Head **bytegleich** zu `main` und #50; nicht erneut blind übernehmen. |
| [#42](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/42) | MFA-Challenge-Limit | ja, gestapelt | Migration 025 und `src/auth.js` am Head bereits bytegleich zu `main`; historische Serie. |
| [#41](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/41) | TOTP-Replay | ja, gestapelt | Migration 024 und `src/mfa.js` bereits bytegleich zu `main`. |
| [#37](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/37) | Recovery-Cooldown | ja, gestapelt | Migration 023 bereits bytegleich zu `main`; der `src/mfa.js`-Stand ist **älter** als `main`. |
| [#36](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/36) | Atomare MFA-Aktivierung | ja, gestapelt | Älterer `src/mfa.js`-Stand, nicht durch heutiges Modul ersetzen. |
| [#35](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/35) | Atomare MFA-Deaktivierung | ja, gestapelt | Älterer `src/mfa.js`-Stand, nicht durch heutiges Modul ersetzen. |
| [#34](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/34) | Gehashte Recovery-Codes | ja, gestapelt | Historische Abhängigkeit, finalen MFA-Stand im aktuellen `main` bewahren. |
| [#33](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/33) | MFA-Login-Zweitfaktor | ja, gestapelt | Migration 022 bereits bytegleich zu `main`, veraltete Basis. |
| [#26](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/26) | Früher Adminrollen-Entwurf | nein, Draft | Nicht an aktuelle MFA anpassen durch Direktmerge; #47 ist die neuere Grundlage. |
| [#12](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/12) | Globales Referenz-CSS | nein | Alte globale CSS-Überschreibungen, visuell isoliert neu bewerten. |
| [#11](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/11) | Designsystem v2 | nein | Altes CSS/Index-Layout, visuell isoliert neu bewerten. |
| [#10](https://github.com/cstaudy/CFS-zockt-Website-Neu/pull/10) | Webseitenstruktur | nein | Alte Seiten-/Index-Änderungen, ggf. nur gezielt übernehmen. |

**Hinweis:** GitHubs `mergeable` bei den gestapelten MFA-PRs bezieht
sich auf den jeweiligen *Zwischen-Branch* als Base, nicht auf einen
sicheren Merge aller alten Fassungen in das aktuelle `main`.
Ein offener PR beweist nicht, dass sein Code in `main` fehlt; Git-
Historie und Dateiinhalte können durch zwischenzeitliche Integration
auseinanderlaufen.

## Alle 49 Branches: Klassifikation gegen main

- **1 Hauptbranch:** `main`.
- **1 aktiver Entwicklungsbranch:** `chore/structured-modernization-plan-2026-11-12`;
  Stand `main..HEAD`: 264 Commits ahead, 0 behind, `mergeable=true` für PR #50.
- **7 vollständig hinter `main` (0 eigene Commits ahead):**
  `codex/clean-login-ui`,
  `codex/clean-site-v2`,
  `codex/core-product-foundation`,
  `codex/integrations-and-admin-foundation`,
  `codex/oauth-error-handling`,
  `codex/reference-design-v1`,
  `codex/render-hardening`.
  Keine direkte Übernahme nötig; **nicht automatisch löschen**.
- **40 divergierte Branches:** haben Git-Historie, die weder schlicht
  ein Vorgänger noch eine reine Fortsetzung des aktuellen `main` ist.
  Dies beweist **nicht**, dass jede alte Codezeile heute noch fehlt.

### Divergierte Branches mit eigenem offenen PR (13)

`security/admin-verified-role-current-main-2026-11-12` (#47),
`security/mfa-consistent-lock-order-2026-11-12` (#43),
`security/mfa-challenge-issuance-limit-2026-11-12` (#42),
`security/mfa-totp-replay-2026-11-12` (#41),
`security/mfa-recovery-rotation-cooldown-2026-11-12` (#37),
`security/mfa-atomic-enable-rotate-2026-11-12` (#36),
`security/mfa-atomic-disable-2026-11-12` (#35),
`security/mfa-hashed-recovery-2026-11-12` (#34),
`security/mfa-login-challenge-2026-11-12` (#33),
`security/verified-admin-role-2026-11-12` (#26),
`codex/reference-system-v2` (#12),
`codex/cfs-design-system-v2` (#11),
`codex/site-wide-clean-v1` (#10).

### Divergierte Branches ohne offenen PR (27)

- **Website/Frontend:** `codex/navigation-cleanup`,
  `codex/playstation-home-v1`,
  `codex/reference-home-structure-v1`,
  `codex/reference-layout-repair-v1`,
  `codex/technical-completion-v1`,
  `codex/tiktok-original-designs-v1`,
  `codex/unified-platform-foundation`,
  `codex/website3-pr`,
  `fix/home-public-social-status-2026-11-12`,
  `fix/login-admin-destination-2026-11-12`,
  `qa/all-pages-anchor-ids-2026-11-12`.
- **HTTP/Backend/Sicherheit:** `fix/json-request-streams-2026-11-12`,
  `fix/password-change-policy-2026-11-12`,
  `fix/upload-filename-validation-2026-11-12`,
  `security/login-attempt-throttle-2026-11-12`,
  `security/mfa-setup-guard-2026-11-12`,
  `security/mfa-totp-verification-2026-11-12`,
  `security/preauthorize-creator-uploads-2026-11-12`,
  `security/private-upload-serving-2026-11-12`.
- **Tests/Datenbank:** `integration/mfa-current-main-2026-11-12`,
  `safety/ci-pg18-backup-restore-2026-11-12`,
  `safety/guard-existing-db-baseline-2026-11-12`,
  `safety/legacy-migration-baseline-2026-11-12`,
  `test/creator-tenant-isolation-2026-11-12`,
  `test/isolated-account-creator-e2e-2026-11-12`,
  `test/legacy-dump-restore-mfa-upgrade-2026-11-12`,
  `test/legacy-postgres-upgrade-2026-11-12`.

**Besonders große Divergenzen:** `codex/technical-completion-v1`
(91 einzigartige Branch-Commits gegenüber `main`, 33 Dateien laut
Vergleich) und `codex/website3-pr` (1 einzigartiger Commit, aber
178 Dateien im Vergleich). Nicht in PR #50 hineinkopieren oder blind
mergen: vorher abschnittsweiser Vergleich und UI-/API-Regressionen.

## Abnahme-Reihenfolge ohne vorzeitigen Merge

1. Aktuellen Betreiberzugang nur **read-only** prüfen: Freigabe einer
   ausdrücklich verifizierten Adminrolle, Testkonto/Restore-Klon,
   dann konfliktsichere Integration des #47-Konzepts. Kein
   automatischer Rollenaufstieg, keine Blindmigration.
2. Separate technische Reviews für PR #50: Kontotrennung, OAuth,
   EventSub, Creator CRUD/Versionskonflikte, Medien, Exportjobs,
   Layout/OBS und Migrations-/Backupplan. Große PRs ggf. thematisch
   aufteilen, ohne Commits/Branches zu verlieren.
3. MFA-Altabhängigkeiten (#33–#43) mit `main` und den bestehenden
   PostgreSQL-Regressionsprüfungen abgleichen und später **nur nach
   expliziter Entscheidung** schließen; alte Branches nicht wieder
   aufeinander mergen.
4. Design- und sonstige divergierte Branches: nur noch tatsächlich
   fehlende Funktionen gegen den aktuellen Code nachziehen. Echte
   Browser-/Responsive- und OBS-Abnahme.
5. Abschließender, genehmigter Restore-Test der Produktivsicherung,
   Operator-/Admin-Preflight, Rollback-/Release-Checkliste und erst
   danach explizite Merge-/Deploy-/DB-Freigabe.

**Dieser Audit ist eine Repository-/Git- und ausgewählte Source-Code-
Prüfung, kein vollständiger Security-Pentest oder Produktionsnachweis.**
