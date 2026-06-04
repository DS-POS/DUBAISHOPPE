create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into public.expense_categories (name) values
  ('Salary'),('Wages'),('Rent'),('Electricity'),('Internet'),
  ('Transport'),('Marketing'),('Maintenance'),('Bank Charges'),('Miscellaneous');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category_id uuid references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  payment_method text default 'cash' check (payment_method in ('cash','upi','card','bank_transfer','cheque')),
  reference_no text,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy "authenticated read expense_categories"
  on public.expense_categories for select to authenticated using (true);

create policy "authenticated all expenses"
  on public.expenses for all to authenticated
  using (true) with check (true);
