create table if not exists password_recovery_attempts (
  id bigint generated always as identity primary key,
  account_id uuid references accounts(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists password_recovery_attempt_account_idx
  on password_recovery_attempts(account_id, created_at desc);
create index if not exists password_recovery_attempt_ip_idx
  on password_recovery_attempts(ip_hash, created_at desc);
