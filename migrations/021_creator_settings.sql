create table if not exists creator_settings(
  account_id uuid primary key references accounts(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
