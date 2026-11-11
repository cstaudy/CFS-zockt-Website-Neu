create table if not exists tool_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  project_id uuid references creator_projects(id) on delete cascade,
  kind text not null,
  status text not null default 'queued' check (status in ('queued','claimed','processing','completed','failed','canceled')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tool_jobs_account_idx on tool_jobs(account_id, created_at desc);
create index if not exists tool_jobs_status_idx on tool_jobs(status, created_at);
