-- Keep a durable per-account cooldown for recovery-code rotation.
-- New MFA activations clear this timestamp when issuing their first code set.
alter table account_mfa
  add column if not exists recovery_rotated_at timestamptz;
