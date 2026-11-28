-- Exact paired-device binding for cut export claims. Draft; deploy only after
-- the explicit migration/backup/legacy-job review. Preserve existing rows.
alter table tool_jobs
  add column if not exists claimed_by_device uuid references launcher_devices(id) on delete set null;

create index if not exists tool_jobs_claimed_device_idx
  on tool_jobs(claimed_by_device, status)
  where claimed_by_device is not null;
