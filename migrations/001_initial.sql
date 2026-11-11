-- CFS Zockt initial PostgreSQL schema.
-- Run this migration once against the Render PostgreSQL database.

create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  display_name text not null,
  role text not null default 'creator' check (role in ('creator', 'admin')),
  plan text not null default 'free',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists sessions_account_id_idx on sessions(account_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists creator_projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in ('widget', 'scene', 'stream', 'cut', 'audio', 'design')),
  name text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'private', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_projects_account_idx on creator_projects(account_id, updated_at desc);
create index if not exists creator_projects_kind_idx on creator_projects(account_id, kind, status);

create table if not exists audit_events (
  id bigserial primary key,
  account_id uuid references accounts(id) on delete set null,
  event_name text not null,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_at_idx on audit_events(created_at desc);
