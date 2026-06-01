-- Phase 1C: trigger to auto-increment product stock and log history on stock_in INSERT
-- Run in Supabase Dashboard → SQL Editor → New Query → Run

CREATE OR REPLACE FUNCTION fn_on_stock_in_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_new_stock INTEGER;
BEGIN
  -- Increment current_stock and capture new value
  UPDATE public.products
  SET current_stock = current_stock + NEW.quantity,
      updated_at    = NOW()
  WHERE id = NEW.product_id
  RETURNING current_stock INTO v_new_stock;

  -- Log to stock_history
  INSERT INTO public.stock_history (product_id, change_type, quantity_change, quantity_after, reference_id, created_by)
  VALUES (NEW.product_id, 'stock_in', NEW.quantity, v_new_stock, NEW.id, NEW.created_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_stock_in_insert ON public.stock_in;
CREATE TRIGGER trg_stock_in_insert
  AFTER INSERT ON public.stock_in
  FOR EACH ROW EXECUTE FUNCTION fn_on_stock_in_insert();
