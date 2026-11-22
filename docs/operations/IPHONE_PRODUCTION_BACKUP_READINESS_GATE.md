# CFS-Zockt: iPhone-only production backup readiness gate

Status: **PREPARATION ONLY — NOT APPROVED TO RUN AGAINST PRODUCTION**.
This document is on the draft backup branch. No production export, secret configuration, merge, deployment or database migration is performed by adding it.

## Confirmed starting point
- Render Free PostgreSQL 18 instance `dpg-dbp1583m8hqs73dqovs0-a`, expiration 2026-12-09 18:36 UTC.
- Render dashboard's built-in Export and Point-in-Time Recovery are disabled on Free.
- Existing `manual-pg18-backup-restore.yml` is **synthetic-only** and contains a public, fixed key suitable **only** for fake data.
- iPhone owner created iCloud Drive `CFS Zockt Backup/Datenbank-Backups` and successfully transferred a 249-byte fake encrypted test file.
- GitHub environment `cfs-backup-protected` was created. User confirmed the settings were saved: required reviewer `cstaudy`, admin bypass unchecked. GitHub environment list displayed `1 protection rule`. Independent API readback and actual approval-enforcement test remain pending.
- Repository is public; do not commit secrets, plaintext exports, production dumps or recovery keys.
- Owner confirmed **Selected branches and tags** with exact `codex/iphone-pg18-backup-restore-draft` was saved. Independent API verification remains pending.
- Render status rechecked 2026-11-19: `available`, `free`, PostgreSQL 18, Frankfurt; network allowlist is `0.0.0.0/0` (all IPv4 sources). This is not anonymous database access, but it is a broad exposure that requires review. Do not change the allowlist before validating backend connectivity and backup access.

## Hard gates before any production read/export
1. Verify environment rules actually saved, reviewer requirement works, restrict deployment branches/tags to the audited backup branch, and review GitHub Actions permissions, forks/PR triggers, artifact retention and runner access. A GitHub environment by itself does **not** make a public repo or its runners private.
2. Explicitly approve the third-party data-processing location and access model for real user data. Consider a genuinely private, isolated export runner rather than a public-repo Actions runner if guarantees cannot be met.
3. Prepare a dedicated least-privilege, time-limited read-only database credential through a secure UI. Do not put `DATABASE_URL` or passwords in chat, logs, workflow inputs, URLs or repository files. Require TLS with certificate verification; check network exposure and IP restrictions.
4. Independently generate a production-only random encryption key, securely store it **outside** the backup folder, and test recovery access. Never use the synthetic workflow's hard-coded key.
5. Audit export pipeline for `set -euo pipefail`, no shell tracing, no secret output, strict file permissions, no plaintext upload, encrypted artifact before any off-runner transfer, and guaranteed temporary-file cleanup on success/failure.
6. Use a PostgreSQL 18-compatible `pg_dump -Fc` (read-only against source), capture schema/data/large objects and necessary roles/extensions/configuration separately, and verify dump manifest, hash, size and integrity. Exporting a live database needs a consistent snapshot and application-specific consideration of external media.
7. Transfer **only encrypted** dump to private iCloud storage on the iPhone. Revoke any prior 'anyone with link can edit' sharing; check that file is fully synchronized and can be downloaded again.
8. Restore independently to a disposable **isolated** PostgreSQL 18 test instance with no production credentials or outbound integration side effects. Validate table counts, representative records, sequences, constraints, extensions and application smoke tests. Never restore over production.
9. Record successful verification, encrypted file SHA-256, Git commit, recovery instructions, separate key custody and retention; only then consider any merge, deployment, migration or expiration-related decision.

## Current STOP conditions
- No authenticated production export tool/runner established.
- No verified private production encryption key and independent recovery copy.
- No production backup and no isolated restore verified.
- Environment configuration not independently re-read.
- No authorization to incur charges or run production-connected workflow.

## Next steps (no secrets yet)
1. Branch restriction has been saved by owner. Independently verify effective GitHub environment settings and approval behavior when connector capability is available.
2. Determine whether the owner accepts processing real user data on a third-party GitHub-hosted runner. If not, choose a different isolated environment; no assumption of approval.
3. Design and review a separate production-only, manual, environment-gated export implementation with a genuinely private encryption key, TLS verification and safe temporary-file handling. Do not attach secrets to the synthetic workflow.
4. Revoke the previous public iCloud edit-link before storing real backups; keep encryption key separately.
5. Do not run a production export, modify Render network rules, merge or deploy until all hard gates pass.

## Audit of current synthetic workflow (2026-11-19)
- Triggered by pull requests modifying the synthetic workflow or its draft documentation, or manual workflow dispatch; no production trigger.
- Global permissions are `contents: read`; no `environment:` entry, no GitHub secrets, no Render host, no production URL, no external backup destination.
- Uses PostgreSQL 18 containers with hard-coded *synthetic-only* users/passwords and publicly known *synthetic-only* AES-GCM keys. It validates isolated restores and tamper rejection.
- Fake encrypted artifacts are retained for one day. This is **not** durable backup storage.
- This workflow must not be repurposed to connect to production by simply adding `DATABASE_URL` or a secret. A separate reviewed production-specific design is required.

Deadline: prioritize a real verified backup before Render Free expiration on **2026-12-09**.