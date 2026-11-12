-- Rate limit issuance of MFA login challenges per account, across all app instances.
-- Additive migration: existing accounts start with an empty challenge window.
alter table account_mfa
  add column if not exists login_challenge_window_started_at timestamptz;
alter table account_mfa
  add column if not exists login_challenge_window_count integer not null default 0;
