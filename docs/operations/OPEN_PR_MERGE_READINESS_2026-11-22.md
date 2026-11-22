# Open PR merge-readiness audit — 2026-11-22

**Scope:** cstaudy/CFS-zockt-Website-Neu. This is a read-only review of PR metadata, documented in a separate branch. **No PR was merged, no deployment or database operation performed.**

| PR | Topic | Draft | GitHub mergeable | Base | Decision |
|---|---|---|---|---|---|
| 52 | Verified admin role | Yes | No | main | Block: production admin readiness, backup and conflicting change |
| 50 | Creator Suite / OBS / Launcher | Yes | No | main | Block: 85 changed files, migrations and release acceptance |
| 47 | Verified admin role (older) | Yes | No | main | Superseded candidate; compare with 52, do not blindly merge both |
| 43 | MFA lock order | Yes | Yes | MFA PR 42 head | Stacked; not independently ready for main |
| 42 | MFA issuance rate limit | Yes | Yes | MFA PR 41 head | Stacked |
| 41 | MFA TOTP replay | Yes | Yes | MFA PR 37 head | Stacked |
| 37 | MFA recovery rotation cooldown | Yes | Yes | MFA PR 36 head | Stacked |
| 36 | MFA atomic enable/rotate | Yes | Yes | MFA PR 35 head | Stacked |
| 35 | MFA atomic disable | Yes | Yes | MFA PR 34 head | Stacked |
| 34 | MFA hashed recovery | Yes | Yes | MFA PR 33 head | Stacked |
| 33 | MFA login challenge | Yes | Yes | MFA verification branch | Stacked |
| 26 | Legacy admin role | Yes | No | main | Older implementation, must not override current MFA flow |
| 12 | Reference design | No | No | main | Conflicts; needs reconciliation |
| 11 | Design system v2 | No | No | main | Conflicts; needs reconciliation |

## Proposed safe merge order

1. Preserve a verified encrypted **real** production backup and test an isolated restore before any schema/auth changes; the previous fake-only test does not meet this gate.
2. Audit what MFA commits are **already present** on main and determine a minimal nonduplicative change set. Rebase a consolidated MFA PR onto current main and rerun full PostgreSQL 18, MFA, login, migration, and restore tests. Require security review before merge.
3. Choose **one** admin-role implementation (prefer the current-main approach if independently validated). Verify existing operator account and email verification on an isolated production-data restore, including rollback and no lockout. Do not merge #26, #47 and #52 blindly.
4. Split #50 by feature and migrations, verify creator/OBS/launcher/Twitch workflows and data privacy, and run full tests before separate approvals.
5. Reconcile #11 and #12 against current design components, resolve conflicts and run website visual/functional checks.

## Notes

- The eight MFA PRs target **other feature branches**, not main. Their `mergeable=true` means mergeability into their specified base only; it does not authorize deployment.
- A draft cannot be merged without being marked ready for review. Non-draft design PRs #11/#12 report merge conflicts.
- This audit checks metadata and PR descriptions, **not** a line-by-line code security review or a current main CI green result.
- Render backend auto-deploy was previously verified disabled; still, changing main can change future deploy content and must be treated as consequential.
- PR #97 was already merged on 2026-11-22, but its production export workflow remains hard-disabled. **No real backup has been established.**

**Release gate:** no production migration, merge of high-risk auth/data changes, deploy, or change of protections before backup, tests, owner approval and rollback evidence.
