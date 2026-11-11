create table if not exists creator_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  media_type text not null default 'image',
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  category text not null default 'image',
  created_at timestamptz not null default now()
);
create index if not exists creator_assets_account_idx on creator_assets(account_id, created_at desc);
