-- Add invoice type and order group linking to invoices table
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS order_group_id UUID,
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'tax_invoice'
    CHECK (invoice_type IN ('tax_invoice', 'bill_of_supply'));

CREATE INDEX IF NOT EXISTS idx_invoices_order_group_id ON invoices(order_group_id);

-- BOS (Bill of Supply) number sequence
CREATE SEQUENCE IF NOT EXISTS bos_no_seq START 1;

CREATE OR REPLACE FUNCTION next_bos_no()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'BOS-' || LPAD(nextval('bos_no_seq')::text, 6, '0');
$$;
