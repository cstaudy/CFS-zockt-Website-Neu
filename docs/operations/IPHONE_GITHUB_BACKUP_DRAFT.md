# iPhone backup preparation — synthetic-only safety gate

**Status: DRAFT. NO PRODUCTION BACKUP. NO DEPLOYMENT.**

The accompanying workflow `.github/workflows/manual-pg18-backup-restore.yml` has been deliberately restricted to **synthetic data only**. It cannot connect to Render or export the real database. It creates two disposable PostgreSQL 18 service databases on GitHub Actions, inserts fake records, performs `pg_dump -Fc`, restores with `pg_restore --exit-on-error`, verifies record count and values, then deletes the temporary dump. No secrets, production URL, external storage or artifact uploads are used.

## iPhone review
1. Open PR #97 in Safari and review the **Files changed** tab.
2. Check the **Checks** tab for the synthetic PostgreSQL 18 test result. A green check demonstrates the *test mechanism*, **not** a production backup.
3. In **Settings → Apple Account → iCloud → Drive**, confirm iCloud Drive is enabled. In **Files → Browse → iCloud Drive**, check access. The owner reports 195 GB free; this is enough space for the approximately 9 MB database but does not establish a secure backup process.
4. Do not paste any database password, connection URL, encryption key or backup content into GitHub, chat or issue comments.

## What is still blocked
- Explicit approval of where real production data may be processed and stored.
- Reviewed authenticated encryption, separate key storage and independent recovery from the retained encrypted file.
- Protected credentials, source identity and TLS checks.
- Approved isolated restore destination and comprehensive schema/roles/constraints/application verification.
- Separate operator authorization before introducing **any** workflow that accesses production.

**Do not merge for the purpose of running a production backup.** A synthetic CI pass is not a release gate pass. See `PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md` and `IPHONE_BACKUP_SECURITY_REVIEW.md`.
