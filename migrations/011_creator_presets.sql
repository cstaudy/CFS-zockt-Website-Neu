create table if not exists creator_presets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in ('caption','export','scene')),
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, kind, name)
);
create index if not exists creator_presets_account_kind_idx on creator_presets(account_id, kind, updated_at desc);
