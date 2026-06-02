-- 003_invoice_sequence.sql
-- Atomic sequential invoice number generation

CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1;

CREATE OR REPLACE FUNCTION next_invoice_no()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_no_seq')::text, 6, '0');
$$;

-- Set as default on invoices table
ALTER TABLE public.invoices
  ALTER COLUMN invoice_no SET DEFAULT next_invoice_no();
