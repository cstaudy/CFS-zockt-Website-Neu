create table if not exists twitch_connections (
  account_id uuid primary key references accounts(id) on delete cascade,
  twitch_user_id text not null,
  login text not null default '',
  display_name text not null default '',
  email text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  expires_at timestamptz,
  scope text not null default '',
  updated_at timestamptz not null default now()
);

