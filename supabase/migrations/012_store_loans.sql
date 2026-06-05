create table public.store_loans (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('lent_out', 'borrowed_in')),
  store_name text not null,
  person_name text not null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  price numeric(12,2) check (price >= 0),
  loan_date date not null default current_date,
  expected_return_date date,
  returned_date date,
  status text not null default 'pending' check (status in ('pending', 'returned', 'converted_to_invoice')),
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.store_loans enable row level security;

create policy "authenticated all store_loans"
  on public.store_loans for all to authenticated
  using (true) with check (true);

create index store_loans_direction_idx on public.store_loans(direction);
create index store_loans_status_idx on public.store_loans(status);
create index store_loans_loan_date_idx on public.store_loans(loan_date desc);
