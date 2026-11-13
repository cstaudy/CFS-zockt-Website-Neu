# Cut Studio export job hardening — no schema migration

This release addresses a cross-account security flaw in the legacy launcher export job API. The previous `PUT /api/launcher/jobs/:id` only checked a shared bridge secret; it did **not** check the job's owning account or whether the requesting launcher was still paired and active.

## Scope

- Validate creator export project UUID, job type `cut_export`, object-only input and 64 KiB payload limit before any database write.
- Serialize queue creation with a PostgreSQL account-row lock: no more than three queued, claimed or processing jobs per account, including concurrent HTTP requests.
- Claim only `cut_export` jobs for the account owning the paired, active launcher. The launcher-device row remains locked until the claim transaction commits, preventing a revoke/claim race.
- Launcher status changes require both the configured shared bridge secret and the active, paired device UUID. Keep the device row lock through the job update; the update also filters by the device's `account_id`, `kind='cut_export'` and legal job state transition.
- Reject missing/malformed status, invalid result JSON and oversized result payloads, preserve only allowed transitions, and reject repeat status transitions.
- Creator cancellation and listing remain account-scoped. A completed or running job is not silently canceled.

## Important remaining limitation

**This version is deliberately account-bound, not claim-device-bound.** An active paired launcher belonging to the same Creator account can update a claim initially obtained by another of that account's devices. Exact `claimed_by_device` tracking requires **migration 026** from Draft #50. Migration 026 is **not** included or applied here because deployment/real backup-and-restore approval has not been established. Do not describe the result as exact per-device claim ownership.

No Render deployment or production database update is manually triggered by this development workflow. An automatic deploy on merges cannot be ruled out until deployment settings are checked.

CI acceptance: locally disposable PostgreSQL HTTP E2E for ownership, shared credential, device UUID, concurrent queue limit, valid/invalid claim+transition, foreign account denial, cancellation, revoked device rejection and reuse of queue capacity; legacy migration/isolated restore checks. Real Launcher acceptance and production backup verification remain distinct gates.
