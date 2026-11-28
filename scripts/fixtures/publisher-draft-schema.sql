-- ISOLATED TEST FIXTURE ONLY. NOT A REGISTERED MIGRATION.
-- Draft-only storage. No worker, authorization or publishing transitions.
-- Account FK reuses existing account ownership. Media ownership is checked
-- transactionally by the adapter; recheck before any future execution.
create table publisher_drafts (
  request_key text primary key check (request_key ~ '^[0-9a-f]{64}$'),
  account_id uuid not null references accounts(id) on delete cascade,
  request_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  media_id uuid not null,
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  created_at timestamptz not null default now(),
  unique (account_id, request_id),
  unique (account_id, request_key)
);
create index publisher_drafts_account_created_idx on publisher_drafts(account_id, created_at desc);
create table publisher_draft_targets (
  target_key text primary key check (target_key ~ '^[0-9a-f]{64}$'),
  account_id uuid not null,
  request_key text not null,
  target text not null check (target in ('tiktok','youtube_shorts','youtube_video','instagram_reels','facebook_reels')),
  state text not null default 'draft' check (state = 'draft'),
  revision integer not null default 0 check (revision = 0),
  attempts integer not null default 0 check (attempts = 0),
  foreign key (account_id, request_key) references publisher_drafts(account_id,request_key) on delete cascade,
  unique (request_key,target)
);
