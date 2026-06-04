alter table public.supplier_invoices
  add column if not exists due_date date,
  add column if not exists supplier_id uuid references public.suppliers(id),
  add column if not exists notes text;

create index if not exists idx_supplier_invoices_supplier_id
  on public.supplier_invoices(supplier_id);
