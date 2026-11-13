-- Twitch EventSub follow ingestion is opt-in, account-scoped and replay-safe.
-- No historical user data is required and no credentials are stored in events.
create table if not exists twitch_follow_subscriptions (
  account_id uuid primary key references accounts(id) on delete cascade,
  subscription_id text not null unique,
  broadcaster_user_id text not null,
  status text not null default 'pending'
    check (status in ('pending','enabled','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Twitch can send the signed verification challenge before the API response
-- supplies the subscription ID. Record that proof independently of request order.
create table if not exists twitch_follow_challenges (
  subscription_id text primary key,
  broadcaster_user_id text not null,
  verified_at timestamptz not null default now()
);

create index if not exists twitch_follow_challenges_verified_idx
  on twitch_follow_challenges(verified_at);

create table if not exists twitch_follow_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  message_id text not null unique,
  broadcaster_user_id text not null,
  follower_user_id text not null,
  follower_name text not null,
  followed_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists twitch_follow_events_recent_idx
  on twitch_follow_events (account_id, followed_at desc, received_at desc);
