create table if not exists oauth_states (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  provider text not null,
  state text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists oauth_states_expiry_idx on oauth_states(expires_at);
create table if not exists tiktok_connections (
  account_id uuid primary key references accounts(id) on delete cascade,
  open_id text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  scope text not null default '',
  updated_at timestamptz not null default now()
);
