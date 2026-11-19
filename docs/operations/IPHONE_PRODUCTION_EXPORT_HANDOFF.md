# iPhone production export handoff — PREPARED, NOT AUTHORIZED TO RUN

Updated 2026-11-19. User requested large preparation blocks and no production export yet.

## Implemented in the draft branch
- Fake-only PostgreSQL 18 end-to-end preflight passed: https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/44493383664
- `scripts/backup/pg18_backup_crypto.py`: versioned `CFSBKP01` AES-256-GCM file format, independent encrypt/decrypt, SHA-256, 1 GiB limit, refuses overwrite and non-PGDMP input.
- `.github/workflows/manual-production-backup-fake-preflight.yml`: adds synthetic-only tests of the production-format encryption utility; await green CI before calling it verified.
- `.github/workflows/production-pg18-encrypted-export-DISABLED.yml`: manually triggered, separate, environment-scoped production export skeleton, **permanently skipped by `if: ${{ false }}` until a later reviewed commit deliberately removes the gate**. Do not remove now.
- No production secrets configured, no production export performed, no Render configuration changed, no deployment, no charge.

## Operator handoff (iPhone)
1. Do not merge PR #97 or press any production workflow button.
2. Open PR #97 Actions/Checks and confirm the new **production-format encryption utility fake-only roundtrip** job is green. If red, diagnose and fix without production secrets.
3. Confirm GitHub environment `cfs-backup-protected` still restricts branches to `codex/iphone-pg18-backup-restore-draft` and required reviewer to `cstaudy`. **One-person approval may be impossible**: GitHub generally does not permit self-approval of a deployment initiated by the same actor. Verify with a no-secret approval smoke test or arrange a second trusted reviewer; never bypass.
4. Plan how to generate and retain a unique private 32-byte key and a second recoverable copy, separate from iCloud encrypted dump. No key exists yet.
5. Plan secure provisioning of a least-privilege PostgreSQL export credential and verify full object coverage. Do not use the public repository, chat, workflow inputs or logs for secrets.
6. Independently validate Render PostgreSQL hostname, certificate chain and `PGSSLMODE=verify-full` / `PGSSLROOTCERT=system` compatibility, and network exposure; do not weaken TLS.
7. Audit the draft export script and pin third-party actions/container/dependencies; ensure artifact handling and cleanup are appropriate. GitHub-hosted runner temporarily holds plaintext; it is not zero-knowledge.
8. Separately design and test a genuinely isolated production-data restore with no outbound integration side effects and a reliable method to transfer encrypted artifact to private iCloud on iPhone. A successful `pg_restore --list` is not a full restore.
9. Only after all checks and a new explicit owner authorization, activate the production workflow in a reviewed commit. **Do not equate preparation approval with export approval.**

## Important limitations
- The current workflow is **hard-disabled**. The user cannot start a real export from it.
- The draft workflow currently assumes a system-trusted certificate and that the database supports it; unverified. It has not been run with real or fake production credentials.
- The artifact's 1-day retention is a transfer window, **not** long-term storage. Private iCloud is the intended archive.
- No actual production backup exists yet. Deadline: Render Free PostgreSQL expires 2026-12-09 18:36 UTC.

## New verification evidence
- Integrated PostgreSQL 18 real custom-format fake-only pipeline, authenticated production-format encryption and isolated restore: **passed** at https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/44497717957.
- Same revision's existing fake-only preflight, synthetic backup validation and website checks also passed.
- A standalone manual-only, no-secret GitHub environment gate smoke workflow was created at `.github/workflows/protected-environment-gate-smoke-MANUAL.yml`. **It has NOT been run**, and its existence does not verify the reviewer protection. The workflow does not read any secrets, contact Render, checkout code or upload artifacts.
- If GitHub does not expose manual dispatch for a workflow absent from the default branch, **do not merge PR #97 just to make it runnable**. A separately reviewed safe test on the default branch or a second trusted reviewer may be needed.
