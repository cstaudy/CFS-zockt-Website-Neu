-- Persistent account/IP throttling for password recovery requests.
-- The IP is stored only as an application-side hash; no source address is
-- persisted. Rollbacks remove the attempt when mail delivery fails.
create table if not exists password_recovery_attempts (
  id bigint generated always as identity primary key,
  account_id uuid references accounts(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists password_recovery_attempts_account_idx
  on password_recovery_attempts(account_id, created_at desc);

create index if not exists password_recovery_attempts_ip_idx
  on password_recovery_attempts(ip_hash, created_at desc);
