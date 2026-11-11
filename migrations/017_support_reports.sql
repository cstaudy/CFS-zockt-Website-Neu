create table if not exists support_reports (
 id uuid primary key default gen_random_uuid(), submission_id text unique, category text not null, priority text not null default 'normal', contact_email text, subject text not null, message text not null, source_path text, status text not null default 'new', admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists support_reports_status_idx on support_reports(status,created_at desc);
