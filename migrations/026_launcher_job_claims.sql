-- Record the exact paired launcher that owns each claimed export job.
-- Applied only by the migration runner in the target environment.
alter table tool_jobs
  add column if not exists claimed_by_device uuid references launcher_devices(id) on delete set null;

create index if not exists tool_jobs_claimed_device_idx
  on tool_jobs(claimed_by_device, status)
  where claimed_by_device is not null;
