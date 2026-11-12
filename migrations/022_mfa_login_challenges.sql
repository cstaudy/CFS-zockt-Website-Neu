-- Short-lived, non-authenticated second-factor challenges. Never store raw cookies.
create table if not exists mfa_login_challenges (
  token_hash text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 5),
  created_at timestamptz not null default now()
);
create index if not exists mfa_login_challenges_account_idx on mfa_login_challenges(account_id);
create index if not exists mfa_login_challenges_expiry_idx on mfa_login_challenges(expires_at);
