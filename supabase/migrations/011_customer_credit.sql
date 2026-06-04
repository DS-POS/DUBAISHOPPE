alter table public.customers
  add column if not exists credit_limit numeric(12,2) not null default 0,
  add column if not exists credit_days integer not null default 30,
  add column if not exists business_name text;
