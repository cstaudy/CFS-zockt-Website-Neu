create table if not exists public_live_controls(
  account_id uuid primary key references accounts(id) on delete cascade,
  active boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
