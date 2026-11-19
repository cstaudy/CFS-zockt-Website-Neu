# Production PostgreSQL backup via GitHub-hosted runner — design only

**Status: NOT EXECUTABLE. No production credentials, no export, no deploy.**
Date: 2026-11-19. Owner approved *further preparation* of GitHub-hosted processing of real CFS-Zockt data, **not** a production export. This document does not grant permission to run one.

## Constraints
- Repository: public `cstaudy/CFS-zockt-Website-Neu`. Draft branch: `codex/iphone-pg18-backup-restore-draft`; existing draft PR #97.
- GitHub environment: `cfs-backup-protected`. Owner reports required reviewer `cstaudy`, admin bypass disabled, and selected branch restriction to exact draft branch. API readback and enforcement test not independently verified.
- Render Free PostgreSQL 18: `dpg-dbp1583m8hqs73dqovs0-a`; expires 2026-12-09 18:36 UTC. Public IPv4 allowlist `0.0.0.0/0`, requiring a separate access-risk review.
- Owner has only an iPhone. Destination: private iCloud Drive `CFS Zockt Backup/Datenbank-Backups`; revoke previous public edit link.
- Existing workflow `manual-pg18-backup-restore.yml` is **synthetic-only**. Its public fake-data keys and artifacts MUST NOT be used for production.

## Proposed architecture, subject to audit
1. Create a **separate** manual-only workflow with `workflow_dispatch` and `permissions: contents: read`; never add production secrets to any PR-triggered workflow. The production job explicitly declares `environment: cfs-backup-protected` and is restricted to a reviewed, immutable commit on the allowlisted branch. Ensure untrusted code cannot be modified after approval; consider an isolated private repository instead if this cannot be guaranteed.
2. Environment secrets are entered by the owner **directly in GitHub UI**, never in chat, logs, commit history or workflow inputs. A dedicated least-privilege database credential is preferred; verify that it can dump all required schemas and objects. No credentials are created yet.
3. Establish verified TLS (certificate chain and hostname) to Render; use a PostgreSQL 18-compatible client and an explicitly controlled, reviewed runner image. Do not relax TLS validation. Audit Render network allowlist and access before connecting.
4. Generate a **unique, production-only** random encryption key under owner-controlled custody, with a separately recoverable copy. Do not use the fake-data fixed key, GitHub's workflow logs, or the same iCloud backup folder as sole key storage. Select and document authenticated encryption format, nonce handling, metadata and a versioned decryptor.
5. After explicit second approval, produce a consistent `pg_dump -Fc` snapshot with restrictive permissions, encrypt it on the runner **before uploading any artifact**; no plaintext dump in logs, repository, cache or artifacts. Avoid `set -x`, redact sensitive errors, and clean temporary files on all paths. GitHub-hosted runners are third-party processing environments; temporary plaintext exists in runner memory/disk while dumping, so this is **not** end-to-end encrypted from Render.
6. Verify the encrypted artifact's size and SHA-256, download it to the iPhone, and place it in private iCloud Drive. GitHub artifact retention is temporary; iCloud is the intended durable copy, not GitHub Actions.
7. Restore **only in a completely isolated PostgreSQL 18 instance** with no production secrets, webhook callbacks or external side effects. Compare schema, row counts, sequences, constraints and critical application behavior; document evidence. Avoid copying personal data into an unnecessarily exposed test environment.
8. Export any external media/objects separately, record exact Git commit, required environment variable **names** (never values), restore instructions, and a key recovery test. Only after this is complete can deployment or expiration decisions be considered.

## Additional approval and open issues
- [x] Owner approves preparation of GitHub-hosted backup processing.
- [ ] Independently verify environment protection, branch restriction, manual trigger and reviewer gate.
- [ ] Security review: public repository Actions exposure, mutable branch, untrusted PRs, permissions, dependencies and runner retention.
- [ ] Decide whether a public-repo GitHub-hosted runner meets privacy obligations for any real user data.
- [ ] Define a safe credential provisioning path with least privilege and verified TLS.
- [ ] Owner creates and securely retains private encryption key; test independent recovery.
- [ ] Implement and review separate production-only workflow; test end-to-end with **fake** data.
- [ ] Revoke public iCloud editing link and verify backup folder privacy.
- [ ] Obtain **separate explicit approval** for actual production export.
- [ ] Perform real encrypted export and isolated restore, and independently verify archived copy.

## Immediate next safe action
Confirm iCloud public edit-link sharing has been stopped. Next, design and review the separate production workflow *without any production secrets or network access*.

**Do not run a production export, merge PR #97, trigger deployment, rotate Render credentials, modify the Render allowlist or upgrade the plan based on this document.**
