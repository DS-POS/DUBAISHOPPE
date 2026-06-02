-- 004_supplier_invoices.sql
-- Supplier invoice header + payment tracking

CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_no text,
  supplier_name text,
  supplier_gstin text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL
    REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_reference text,
  payment_method text CHECK (payment_method IN ('cash', 'cheque', 'neft', 'upi', 'rtgs')),
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Link stock_in rows to their parent supplier invoice
ALTER TABLE public.stock_in
  ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid
    REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users supplier_invoices"
  ON public.supplier_invoices FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth users supplier_payments"
  ON public.supplier_payments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
