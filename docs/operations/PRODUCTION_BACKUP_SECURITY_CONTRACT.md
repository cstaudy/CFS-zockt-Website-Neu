# CFS-Zockt production backup — implementation security contract

**DESIGN REVIEW ONLY. No executable production workflow or credentials.**
Prepared 2026-11-19 after successful *synthetic-only* PostgreSQL 18 preflight. The owner authorized preparation on GitHub-hosted infrastructure but explicitly prohibited starting a production export.

## Critical approval-gate caveat

GitHub's required-reviewer gate is not the same as independent approval. In particular, the user who starts a deployment generally cannot approve their own pending deployment; leaving "prevent self-review" unchecked does not guarantee self-approval is possible. With only one GitHub account (`cstaudy`) listed as reviewer, the eventual production workflow may **block awaiting approval**. Do not disable the gate or turn on administrator bypass to work around this. Before using any real credentials, verify the actual behavior with a no-secret, no-production-data job, or arrange a second trusted reviewer if needed. The branch allowlist and reviewer settings have been reported by the owner but not independently verified via API.

## Separation of trust

- Synthetic preflight: PR-triggered, fixed *public* fake-data key, no environment, no production secrets, no real database connections. Keep this separate.
- Production export (future): `workflow_dispatch` **only**; a separate audited workflow file and explicitly protected environment `cfs-backup-protected`. Never accept database host, password, SQL or shell commands as dispatch inputs.
- Use environment-scoped secrets rather than repository-wide secrets. GitHub Actions' code on the permitted branch must be treated as privileged once secrets are attached; branch restrictions alone do not pin a reviewed commit. Review and freeze the exact SHA and verify that untrusted contributors cannot alter it.
- Permissions: `contents: read` and no write permissions, no third-party marketplace actions without pinning/review, no caching plaintext or secrets, minimal artifact retention.
- Only **encrypted** output can leave the runner as a workflow artifact. Plaintext exists transiently during `pg_dump` on GitHub's third-party runner and must be removed; this does not provide zero-knowledge processing.

## Credentials and cryptography prerequisites

1. Determine a read-only PostgreSQL account that can actually read all required schema objects, table data, sequences and large objects. PostgreSQL privileges can make a nominally read-only account produce incomplete dumps; validate coverage. Provision through a secure UI or audited SQL path, never through chat.
2. Do not reuse the backend's full-privilege `DATABASE_URL` if a least-privilege export account can be used. Do not create a new database user or modify production permissions without separate authorization and a rollback plan.
3. Require PostgreSQL 18 client and verified TLS with server certificate validation (`sslmode=verify-full` and a trusted CA, when supported by the endpoint). Never substitute `sslmode=require` as proof of hostname verification. Confirm Render endpoint and CA requirements before implementation.
4. Choose a versioned authenticated encryption format with a fresh cryptographic nonce per backup, authenticated header/metadata and independent decryption tooling. The production key must be randomly generated and privately stored by the owner, with a second recovery copy kept separately from the encrypted backup. Never put the key in the repo, chat, workflow inputs or logs.
5. No production secrets are configured yet. Proposed names for future review only: `CFS_BACKUP_PGHOST`, `CFS_BACKUP_PGPORT`, `CFS_BACKUP_PGDATABASE`, `CFS_BACKUP_PGUSER`, `CFS_BACKUP_PGPASSWORD`, `CFS_BACKUP_ENCRYPTION_KEY`; endpoint CA trust must also be specified. These are **names**, not values.

## Required safety tests before any real export

- [ ] No-secret environment approval smoke test verifies reviewer and branch enforcement, including the one-account/self-approval case.
- [ ] Audited production workflow reviewed at an exact immutable commit; no PR trigger and no secret-exposing fork path.
- [ ] Tested `pg_dump -Fc` and `pg_restore --list` against fake PG18 source with production-like permissions, TLS and cryptography; ensure cleanup on error and no plaintext upload.
- [ ] Encryption key recovery tested independently; corrupted ciphertext rejected; wrong key rejected; plaintext never printed.
- [ ] Confirm the old public iCloud edit link remains revoked, and verify that encrypted file can be downloaded from private iCloud on iPhone.
- [ ] Confirm no Render service deploy, startup migration, DB configuration change or charge will be triggered.
- [ ] Explicit separate owner approval for production export, after a plain-language risk summary.
- [ ] Actual production dump and independent isolated restore; until then the database is **not backed up**.

## Rollback and stop conditions

If reviewer approval cannot work with a single account, **STOP**. Do not weaken protection; consider a trusted second reviewer or a genuinely private alternative. If Render TLS verification or least-privilege access cannot be demonstrated, **STOP**. If key custody is uncertain, **STOP**. If export runs but encrypted file is not recovered and restored independently, **do not claim a verified backup**.

Deadline: Render Free database expires 2026-12-09 18:36 UTC. No paid upgrade authorized.
