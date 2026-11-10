alter table launcher_devices add column if not exists obs_connected boolean not null default false;
alter table launcher_devices add column if not exists obs_version text;

