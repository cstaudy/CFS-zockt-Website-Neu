# iPhone operator draft: encrypted production PostgreSQL backup

**Status: DRAFT / NOT EXECUTED / NOT APPROVED FOR PRODUCTION USE.**

This PR adds a **manual-only** GitHub Actions workflow. It does not run on pushes, PRs, or merges. Do not dispatch until the production owner has approved export, retention, access, costs and isolated restore handling.

## Operator setup (via Safari on iPhone)
1. Review the workflow and the repository's existing `docs/operations/PRODUCTION_BACKUP_RESTORE_OPERATOR_RUNBOOK.md`.
2. Create a protected GitHub Actions environment named `production-backup` with required reviewer approval and restrict deployment branches to the trusted default branch where available. Verify environment protections available on the repository plan and visibility.
3. Configure two **environment secrets**, never commit or paste their values into issues/chat:
   - `PRODUCTION_DATABASE_URL`: authorized **read-only / dump-capable** connection string for the exact production database, with appropriate TLS configuration.
   - `BACKUP_ENCRYPTION_PASSPHRASE`: randomly generated high-entropy passphrase (minimum 24 characters), stored separately from the backup.
4. In Actions, manually select **Manual encrypted PostgreSQL 18 backup and isolated restore (draft)** and enter `BACKUP_AND_RESTORE`. **Do not do this until an operator approves the export and isolated restore.**
5. After a successful run, securely download the **encrypted** artifact and its SHA-256 to independent, access-restricted storage; verify checksum, encryption-key recoverability and retention. GitHub artifact retention is **only 7 days**, so the artifact is NOT a durable backup.
6. An authorized operator must separately test decrypting the retained copy in a controlled environment and verify application roles/permissions, sequences, constraints and read-only application functionality. This workflow only checks that pg_restore completes and public table counts agree; it is **not** full recovery acceptance.

## iPhone storage decision (no credentials required)

iCloud Drive can be considered **only as a destination for an already encrypted and authenticated backup**. It is not a PostgreSQL backup tool and cannot execute `pg_dump` or `pg_restore`. Do not save an unencrypted dump, database connection URL or encryption key in the same iCloud folder.

On iPhone, open **Settings → Apple Account → iCloud → Drive** to check whether iCloud Drive is enabled, then open **Files → Browse → iCloud Drive** to check that the destination is accessible. The operator must separately confirm available space, account security, sharing restrictions, retention and ability to recover the file on a second device or environment. This is a preparation check, not an instruction to upload production data.

If iCloud Drive is unavailable or unsuitable, select another independently accessible protected storage service. No storage service is preapproved by this document.

**Before running anything**, a reviewer must resolve the blocking findings in `IPHONE_BACKUP_SECURITY_REVIEW.md`, particularly authenticated encryption and independent recovery from the retained encrypted artifact. Do not configure secrets or dispatch the current draft merely because iCloud Drive is visible.

## Safety boundaries
- Uses PostgreSQL 18 client and a separate PostgreSQL 18 service container. Never restores into production.
- Export uses `pg_dump -Fc --no-owner --no-acl`; restore uses `pg_restore --exit-on-error`.
- Production connection is used only for dump and read-only inventory. No production migrations, schema writes or deployment.
- Unencrypted dump exists transiently inside the GitHub runner and is removed after processing; the encrypted backup alone is uploaded. GitHub-hosted runner, artifact access, and secrets handling require an explicit data-protection decision.
- The restored copy contains real production data inside a temporary runner service. Approve this processing and access before running.
- Do not mistake a green GitHub Actions run or matching table counts for a fully verified disaster-recovery procedure.
- If secrets are absent or approval is missing, **STOP**.
- This is a draft proposal only; review shell/tooling, repository permissions, and all security gates before merge or dispatch.
