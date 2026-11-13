# Read-only Admin readiness check

**Status: non-mutating diagnostic only.** This branch does not change admin privileges, email verification, MFA, session behavior or the production database.

The existing production authorization still needs separate hardening. The planned authorization requires a designated operator email, an explicit `accounts.role = 'admin'`, and `email_verified_at`. This diagnostic reports whether those prerequisites are present, without granting access.

## Run on an explicitly authorized database target

```sh
CONFIRM_ADMIN_PREFLIGHT_READ_ONLY=yes npm run admin:preflight
```

Supply `DATABASE_URL` only for a previously authorized database, preferably an isolated restored backup. The command refuses to run without `CONFIRM_ADMIN_PREFLIGHT_READ_ONLY=yes`, begins a PostgreSQL `READ ONLY` transaction and ends with `ROLLBACK`. It prints only four boolean fields: `account_exists`, `role_ready`, `email_ready`, `ready`; missing prerequisites result in exit code 2. No account ID, email, credentials or secrets are printed.

**Important:** `ready=true` does not authorize changing roles, deploying code, or running migrations. Before any production rollout, separately verify a real backup/restore, authorized operator access, actual MFA login and rollback procedure. Do not mark an email verified or grant a role automatically.
