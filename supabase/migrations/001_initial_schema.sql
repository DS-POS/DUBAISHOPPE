-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  barcode text unique,
  category_id uuid references public.categories(id),
  brand text,
  cost_price numeric(10,2) not null default 0,
  selling_price numeric(10,2) not null default 0,
  gst_rate numeric(5,2) not null default 18,
  hsn_code text,
  current_stock integer not null default 0,
  low_stock_alert integer default 5,
  serial_required boolean default false,
  image_url text,
  status text default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.product_serials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  serial_number text not null,
  status text default 'available' check (status in ('available', 'sold', 'damaged', 'returned')),
  stock_in_id uuid,
  invoice_id uuid,
  created_at timestamptz default now()
);

create table public.stock_in (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  quantity integer not null,
  cost_price numeric(10,2) not null,
  supplier_name text,
  supplier_gstin text,
  purchase_invoice_no text,
  purchase_date date default current_date,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.stock_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  change_type text check (change_type in ('stock_in', 'sale', 'adjustment', 'return')),
  quantity_change integer not null,
  quantity_after integer not null,
  reference_id uuid,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  gstin text,
  address text,
  state text default 'Telangana',
  created_at timestamptz default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  customer_id uuid references public.customers(id),
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) default 0,
  taxable_amount numeric(10,2) not null default 0,
  cgst numeric(10,2) default 0,
  sgst numeric(10,2) default 0,
  igst numeric(10,2) default 0,
  total_gst numeric(10,2) default 0,
  grand_total numeric(10,2) not null default 0,
  payment_method text check (payment_method in ('cash', 'upi', 'card', 'bank_transfer', 'credit')),
  status text default 'paid' check (status in ('paid', 'pending', 'cancelled')),
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  sku text,
  hsn_code text,
  serial_number text,
  quantity integer not null,
  rate numeric(10,2) not null,
  discount numeric(10,2) default 0,
  gst_rate numeric(5,2) default 0,
  taxable_amount numeric(10,2) not null,
  cgst numeric(10,2) default 0,
  sgst numeric(10,2) default 0,
  igst numeric(10,2) default 0,
  total numeric(10,2) not null
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_no text unique not null,
  customer_id uuid references public.customers(id),
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) default 0,
  taxable_amount numeric(10,2) not null default 0,
  cgst numeric(10,2) default 0,
  sgst numeric(10,2) default 0,
  igst numeric(10,2) default 0,
  total_gst numeric(10,2) default 0,
  grand_total numeric(10,2) not null default 0,
  valid_until date,
  status text default 'draft' check (status in ('draft','sent','accepted','expired','rejected')),
  converted_invoice_id uuid references public.invoices(id),
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  sku text,
  hsn_code text,
  quantity integer not null,
  rate numeric(10,2) not null,
  discount numeric(10,2) default 0,
  gst_rate numeric(5,2) default 0,
  taxable_amount numeric(10,2) not null,
  cgst numeric(10,2) default 0,
  sgst numeric(10,2) default 0,
  igst numeric(10,2) default 0,
  total numeric(10,2) not null
);

create table public.tally_ledger_mapping (
  id uuid primary key default gen_random_uuid(),
  pos_field text not null,
  tally_ledger_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.export_logs (
  id uuid primary key default gen_random_uuid(),
  export_type text not null,
  date_from date,
  date_to date,
  file_url text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  updated_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_serials enable row level security;
alter table public.stock_in enable row level security;
alter table public.stock_history enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.tally_ledger_mapping enable row level security;
alter table public.export_logs enable row level security;
alter table public.settings enable row level security;

create policy "auth_users_all" on public.users for all using (auth.role() = 'authenticated');
create policy "auth_categories_all" on public.categories for all using (auth.role() = 'authenticated');
create policy "auth_products_all" on public.products for all using (auth.role() = 'authenticated');
create policy "auth_serials_all" on public.product_serials for all using (auth.role() = 'authenticated');
create policy "auth_stock_in_all" on public.stock_in for all using (auth.role() = 'authenticated');
create policy "auth_stock_history_all" on public.stock_history for all using (auth.role() = 'authenticated');
create policy "auth_customers_all" on public.customers for all using (auth.role() = 'authenticated');
create policy "auth_invoices_all" on public.invoices for all using (auth.role() = 'authenticated');
create policy "auth_invoice_items_all" on public.invoice_items for all using (auth.role() = 'authenticated');
create policy "auth_quotations_all" on public.quotations for all using (auth.role() = 'authenticated');
create policy "auth_quotation_items_all" on public.quotation_items for all using (auth.role() = 'authenticated');
create policy "auth_tally_all" on public.tally_ledger_mapping for all using (auth.role() = 'authenticated');
create policy "auth_export_logs_all" on public.export_logs for all using (auth.role() = 'authenticated');
create policy "auth_settings_all" on public.settings for all using (auth.role() = 'authenticated');

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Default tally mappings
insert into public.tally_ledger_mapping (pos_field, tally_ledger_name) values
  ('cash_sales', 'Cash'),
  ('upi_sales', 'UPI Bank Ledger'),
  ('card_sales', 'Card Settlement Ledger'),
  ('sales_18_gst', 'Sales GST 18%'),
  ('cgst_output', 'Output CGST'),
  ('sgst_output', 'Output SGST'),
  ('igst_output', 'Output IGST'),
  ('customer_ledger', 'Sundry Debtors'),
  ('supplier_ledger', 'Sundry Creditors');

-- Default settings
insert into public.settings (key, value) values
  ('store_name', 'DUBAI SHOPPE'),
  ('store_tagline', 'A Professional Camera Store'),
  ('store_address', '5-1-750/2, Haridas Market Bank Street, Koti, Hyderabad - 500095'),
  ('store_gstin', '36ALBPM0907C1ZO'),
  ('store_state', 'Telangana'),
  ('store_state_code', '36'),
  ('store_phone1', '9885878645'),
  ('store_phone2', '9866141485'),
  ('store_email', 'dubaishoppe_hyd@yahoo.com'),
  ('invoice_prefix', 'INV'),
  ('quotation_prefix', 'QUO'),
  ('invoice_counter', '0'),
  ('quotation_counter', '0'),
  ('low_stock_threshold', '5');
