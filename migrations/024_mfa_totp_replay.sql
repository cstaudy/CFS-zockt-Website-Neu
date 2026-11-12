-- Prevent reuse of a successful TOTP in a later login challenge.
-- Nullable for existing installations. Nothing touches production accounts here.
alter table account_mfa
  add column if not exists last_login_totp_step bigint;
