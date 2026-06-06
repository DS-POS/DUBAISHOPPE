-- Customer refunds: track when store refunds money to customer
-- Used for: returns that exceed amount paid (store owes customer)
create table if not exists customer_refunds (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  order_group_id uuid,           -- populated for split orders; null for single invoices
  amount       numeric(10, 2) not null check (amount > 0),
  method       text not null default 'cash',
  refund_date  date not null default current_date,
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists customer_refunds_invoice_id_idx on customer_refunds (invoice_id);
create index if not exists customer_refunds_group_id_idx on customer_refunds (order_group_id) where order_group_id is not null;
