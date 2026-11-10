create table if not exists user_media (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  folder text not null default 'videos' check (folder in ('videos','clips')),
  name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_media_account_folder_idx on user_media(account_id, folder, created_at desc);

