CREATE SEQUENCE IF NOT EXISTS quotation_no_seq START 1;

CREATE OR REPLACE FUNCTION next_quotation_no()
RETURNS text LANGUAGE sql AS $$
  SELECT 'QUO-' || LPAD(nextval('quotation_no_seq')::text, 6, '0');
$$;

ALTER TABLE public.quotations
  ALTER COLUMN quotation_no SET DEFAULT next_quotation_no();
