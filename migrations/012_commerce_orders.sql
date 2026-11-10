create table if not exists commerce_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  provider text not null default 'paypal',
  provider_order_id text unique,
  product_key text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  status text not null default 'created' check (status in ('created','approved','captured','failed','canceled')),
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commerce_orders_account_idx on commerce_orders(account_id, created_at desc);

