create table if not exists account_mfa (
  account_id uuid primary key references accounts(id) on delete cascade,
  secret text not null,
  enabled boolean not null default false,
  recovery_codes jsonb not null default '[]'::jsonb,
  enabled_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists account_security_events (
  id bigserial primary key, account_id uuid references accounts(id) on delete cascade, event_type text not null, created_at timestamptz not null default now()
);
create index if not exists account_security_events_idx on account_security_events(account_id,created_at desc);

