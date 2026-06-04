-- 008_gst_config.sql
alter table public.products
  add column if not exists is_taxable boolean not null default true;

alter table public.invoice_items
  add column if not exists is_taxable boolean not null default true;
