-- 016_complete_billing_schema.sql
-- Adds ALL missing columns and tables required for invoice creation and viewing.
-- Safe to run multiple times — all use IF NOT EXISTS / OR REPLACE.

-- ─────────────────────────────────────────────────────────────
-- 1. Missing columns on invoices
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'tax_invoice'
    CHECK (invoice_type IN ('tax_invoice', 'bill_of_supply')),
  ADD COLUMN IF NOT EXISTS order_group_id UUID,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS total_returns NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS insurance_claim_no TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_order_group_id ON public.invoices(order_group_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Update payment_method CHECK to include 'insurance'
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_method_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_method_check
    CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'credit', 'insurance'));

-- ─────────────────────────────────────────────────────────────
-- 3. Invoice number sequence + function
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1;

CREATE OR REPLACE FUNCTION next_invoice_no()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'INV-' || LPAD(nextval('invoice_no_seq')::text, 6, '0');
$$;

ALTER TABLE public.invoices
  ALTER COLUMN invoice_no SET DEFAULT next_invoice_no();

-- ─────────────────────────────────────────────────────────────
-- 4. BOS number sequence + function
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS bos_no_seq START 1;

CREATE OR REPLACE FUNCTION next_bos_no()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'BOS-' || LPAD(nextval('bos_no_seq')::text, 6, '0');
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Invoice payments table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0.01),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash','upi','card','bank_transfer','credit')) DEFAULT 'cash',
  payment_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'invoice_payments_auth_all'
      AND tablename  = 'invoice_payments'
  ) THEN
    CREATE POLICY "invoice_payments_auth_all" ON public.invoice_payments
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);

-- ─────────────────────────────────────────────────────────────
-- 6. Customer refunds table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_group_id UUID,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash',
  refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_refunds_invoice_id_idx ON public.customer_refunds(invoice_id);
CREATE INDEX IF NOT EXISTS customer_refunds_group_id_idx ON public.customer_refunds(order_group_id)
  WHERE order_group_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 7. Sales return number sequence + function
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS return_no_seq START 1;

CREATE OR REPLACE FUNCTION next_return_no()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'RET-' || LPAD(nextval('return_no_seq')::text, 6, '0');
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. Sales returns table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_no TEXT UNIQUE NOT NULL DEFAULT next_return_no(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  refund_method TEXT NOT NULL CHECK (
    refund_method IN ('cash','upi','card','bank_transfer','store_credit','no_refund','balance_adjustment')
  ),
  total_refund NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sales_returns_auth_all'
      AND tablename  = 'sales_returns'
  ) THEN
    CREATE POLICY "sales_returns_auth_all" ON public.sales_returns
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice_id ON public.sales_returns(invoice_id);

-- ─────────────────────────────────────────────────────────────
-- 9. Sales return items table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES public.invoice_items(id),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  serial_number TEXT,
  quantity_returned INTEGER NOT NULL,
  rate NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  taxable_amount NUMERIC(10,2) NOT NULL,
  cgst NUMERIC(10,2) DEFAULT 0,
  sgst NUMERIC(10,2) DEFAULT 0,
  igst NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL
);

ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sales_return_items_auth_all'
      AND tablename  = 'sales_return_items'
  ) THEN
    CREATE POLICY "sales_return_items_auth_all" ON public.sales_return_items
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON public.sales_return_items(return_id);
