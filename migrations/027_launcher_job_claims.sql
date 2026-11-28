-- Bind every launcher export job to the exact active device that claimed it.
-- A device from the same account must not be able to complete another device's
-- job after a claim has been issued.
alter table tool_jobs
  add column if not exists claimed_by_device uuid references launcher_devices(id) on delete set null;

create index if not exists tool_jobs_claimed_device_idx
  on tool_jobs(claimed_by_device, status)
  where claimed_by_device is not null;
