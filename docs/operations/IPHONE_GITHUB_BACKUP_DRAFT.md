# iPhone backup preparation — synthetic-only safety gate

**Status: DRAFT. NO PRODUCTION BACKUP. NO DEPLOYMENT.**

The workflow `.github/workflows/manual-pg18-backup-restore.yml` uses **synthetic data only**. It has no Render connection or production credentials. It now includes separate PostgreSQL 18 dump/restore, AES-256-GCM authentication, encrypted artifact transfer, and a full synthetic PostgreSQL dump → encrypted GitHub artifact → separate job → authenticated decryption → isolated restore test. The synthetic-only artifacts are retained for **one day** on GitHub. They are not production backups and do not constitute durable storage.

## Verified GitHub Actions evidence
- Synthetic PostgreSQL dump and restore: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43788807489
- AES-256-GCM tamper and wrong-key rejection: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43855794855
- Encrypted synthetic artifact transfer between jobs: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43856450742
- Full encrypted synthetic PostgreSQL backup transfer and isolated restore: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/43859076418

## iPhone-only independent-storage rehearsal (FAKE DATA ONLY)
1. Open the latest successful **Synthetic PostgreSQL 18 backup and restore validation** run in Safari, while signed in to GitHub. Under **Artifacts**, choose `synthetic-only-encrypted-postgres`. GitHub may download a ZIP; if the artifact has expired, rerun the synthetic workflow from the GitHub **Actions** tab (only if you have permission) and wait for a green result.
2. In Safari's Downloads or the **Files** app, find the downloaded ZIP. Tap it to extract it, then locate `synthetic-postgres.enc`. Confirm the name; **never** substitute a production dump or any real database export.
3. In **Files → Browse → iCloud Drive**, create a private folder such as `CFS-Zockt/Synthetic-Recovery-Test`. Move or copy only `synthetic-postgres.enc` there. Do not share the folder or create a public link. iCloud sync and access should be confirmed, not assumed.
4. Close Files, reopen the iCloud Drive folder, and verify the encrypted file is present and downloadable. Prefer verifying on a second trusted device or after a fresh iCloud session if one is available; merely seeing a cached local file does not prove remote recoverability.
5. Record only **date/time, file name, approximate size, folder location and whether retrieval worked** in the operator evidence. Never post database passwords, production connection strings, private keys or real backup contents.
6. **Important limitation:** this iPhone rehearsal proves file handling only. The current workflow does not accept an uploaded iCloud copy for cryptographic validation or database restore. Mark independent-storage restore as **NOT VERIFIED** until a separate, approved recovery exercise reads back that exact stored copy and restores it.

The synthetic test uses a deliberately public, fixed encryption key; **never reuse that key for real data**. No production key custody method has been approved. The operator reports approximately 195 GB of free iCloud Drive space, but capacity alone does not establish privacy, recoverability or approved storage location.

## What remains blocked
- Explicit approval of where real production data may be processed and stored.
- Reviewed authenticated encryption, separate recoverable production key custody and independent recovery from the retained encrypted file.
- Protected credentials, source identity and TLS certificate checks.
- Approved isolated restore destination and comprehensive schema, roles, constraints, extensions and application verification.
- Separate operator authorization before introducing **any** workflow that accesses production.

**Do not merge for the purpose of running a production backup.** A green synthetic CI test is not a production recovery guarantee. See `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md` and `AUTHENTICATED_BACKUP_RECOVERY_PLAN.md`.

**Render Free PostgreSQL expiry: 2026-12-09 at 18:36 UTC.** A separately authorized, verified durable backup and database replacement plan are urgent.
