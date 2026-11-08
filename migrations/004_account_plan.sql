alter table if exists accounts
  add column if not exists plan text not null default 'free';

