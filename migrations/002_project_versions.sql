alter table creator_projects add column if not exists version integer not null default 1;
create index if not exists creator_projects_version_idx on creator_projects(id, version);
