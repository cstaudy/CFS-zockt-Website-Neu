create table if not exists launcher_devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  machine_name text not null default 'Creator PC',
  client_version text,
  device_code text unique,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  last_seen_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists launcher_devices_account_idx on launcher_devices(account_id, updated_at desc);
create index if not exists launcher_devices_code_idx on launcher_devices(device_code);

