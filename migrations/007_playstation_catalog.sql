create table if not exists creator_playstation_profiles (
  account_id uuid primary key references accounts(id) on delete cascade,
  provider text not null default 'launcher',
  platform text,
  display_name text,
  connected boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists creator_playstation_games (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  title text not null,
  platform text,
  cover_url text,
  last_played_at timestamptz,
  in_catalog boolean not null default true,
  source text not null default 'launcher',
  updated_at timestamptz not null default now()
);
create unique index if not exists creator_playstation_games_unique_idx on creator_playstation_games(account_id, title, coalesce(platform, ''));
create index if not exists creator_playstation_games_recent_idx on creator_playstation_games(account_id, last_played_at desc nulls last);
create table if not exists creator_playstation_videos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  title text not null,
  url text not null,
  thumbnail_url text,
  published_at timestamptz,
  source text not null default 'launcher',
  updated_at timestamptz not null default now()
);

