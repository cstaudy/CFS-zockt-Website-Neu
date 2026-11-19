# CFS-Zockt: independent production-export readiness audit

Audit date: 2026-11-19. **Verdict: NOT READY FOR REAL EXPORT.** This report does not authorize activation of the disabled workflow.

## Evidence verified directly
- Render PostgreSQL ID `dpg-dbp1583m8hqs73dqovs0-a`: status **available**, PostgreSQL **18**, **free**, Frankfurt, expiry **2026-12-09 18:36:16 UTC**.
- Database public IPv4 allowlist is `0.0.0.0/0`; this is network reachability, **not** anonymous database access. No allowlist changes made.
- Render backend `srv-da5dhsmk1f9s738bf9a0`: `autoDeploy=no`, `autoDeployTrigger=off`, Free plan, start command `npm start`. No deploy or service change made.
- GitHub integrated fake-only PostgreSQL 18 export, AES-GCM production-format encryption, and isolated restore: **success**, https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/44497717957.
- Earlier fake-only encryption tamper/wrong-key test: **success**, https://github.com/cstaudy/CFS-zockt-Website-Neu/actions/runs/44496056472.
- Protected environment smoke workflow exists, but has **not** run; reviewer/branch enforcement is **not independently established**.
- Production export workflow remains hard-disabled with `if: ${{ false }}`. No real export performed.

## Blockers — do not remove hard stop yet

| Gate | State | Evidence needed |
|---|---|---|
| Protected environment reviewer and branch enforcement | BLOCKED | No-secret smoke test with observed GitHub approval and deployment history; account initiating workflow may not be able to self-approve |
| Actual manual dispatch of branch-only workflow | BLOCKED | Confirm GitHub supports safe dispatch without merging unsafe code; do not merge PR #97 merely to make dispatch visible |
| Production connection host and CA chain | BLOCKED | Verified endpoint and `sslmode=verify-full` handshake; no credentials in chat |
| Least-privilege dump account and schema/sequence/large-object coverage | BLOCKED | Owner-approved provisioning and evidence; no changes to production permissions without approval |
| Production-only key custody | BLOCKED | Random 256-bit key securely generated and held by owner, separate recovery copy, tested recovery; never commit or send key in chat |
| Protected source code and supply chain | BLOCKED | Pin actions and PostgreSQL container to audited immutable digests; protect exact reviewed commit and limit who can modify branch |
| Isolated recovery of real data | BLOCKED | Approved private isolated environment, restore procedure and independent verification, no external side effects |
| Private iCloud durable retention | BLOCKED | Confirm folder remains private and owner can retrieve encrypted file; GitHub artifact retention is only 1 day |
| Real export completion | NOT STARTED | Actual encrypted archive, verified checksum, private durable copy and isolated restore evidence |

## Important code-review findings

1. Current production workflow uses mutable `actions/checkout@v4`, `actions/upload-artifact@v4`, and `postgres:18` image tag; pin reviewed SHAs/digests before activation.
2. `PGSSLROOTCERT=system` and `PGSSLMODE=verify-full` are intended to validate TLS, but Render endpoint trust and the container's PostgreSQL 18 libpq behavior have not been verified against production.
3. `python3-cryptography` is installed at runtime via `apt` in the draft; dependency and image immutability need review. Cryptography utility currently buffers whole dump in RAM and rejects files larger than 1 GiB; current database appears smaller, but no live size proof in this audit.
4. `pg_restore --list` only checks archive readability, **not** that a full restore succeeds or the application works. Never claim that the disabled workflow alone verifies recoverability.
5. GitHub-hosted runner will temporarily contain plaintext and DB credentials. Confirm privacy/legal acceptability before connecting production.
6. User's instruction to perform **one** real export once tests pass is conditional authorization, **not** permission to bypass unresolved security gates or to change production settings.

## Next controlled actions

- Run no-secret approval smoke test **only if** it can be dispatched without merging unsafe code. Otherwise prepare a separately reviewed default-branch no-secret workflow and request explicit merge approval before merging anything.
- Validate and harden the workflow and restore runbook without real data.
- Arrange secure owner-only key creation and DB credential provisioning **outside chat** once gate design is approved.
- Once every gate is evidenced, review the exact workflow commit and the user's conditional authorization, then execute **at most one** real export. Verify encrypted download and isolated recovery before calling it a successful backup.

**No production export, deployment, secret creation, Render configuration modification, or paid plan upgrade occurred during this audit.**
