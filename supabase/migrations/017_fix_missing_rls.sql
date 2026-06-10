-- 017_fix_missing_rls.sql
-- Enable RLS on all tables that were created without it.
-- Safe to run multiple times.

-- customer_refunds (missing RLS from migrations 014 + 016)
ALTER TABLE public.customer_refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'customer_refunds_auth_all'
      AND tablename  = 'customer_refunds'
  ) THEN
    CREATE POLICY "customer_refunds_auth_all" ON public.customer_refunds
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- suppliers (may have been created via dashboard without RLS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'suppliers'
  ) THEN
    EXECUTE 'ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'suppliers'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'suppliers_auth_all' AND tablename = 'suppliers'
  ) THEN
    EXECUTE 'CREATE POLICY "suppliers_auth_all" ON public.suppliers FOR ALL USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- stock_adjustments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_adjustments'
  ) THEN
    EXECUTE 'ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_adjustments'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'stock_adjustments_auth_all' AND tablename = 'stock_adjustments'
  ) THEN
    EXECUTE 'CREATE POLICY "stock_adjustments_auth_all" ON public.stock_adjustments FOR ALL USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- purchase_orders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    EXECUTE 'ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'purchase_orders_auth_all' AND tablename = 'purchase_orders'
  ) THEN
    EXECUTE 'CREATE POLICY "purchase_orders_auth_all" ON public.purchase_orders FOR ALL USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- purchase_order_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
  ) THEN
    EXECUTE 'ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'purchase_order_items_auth_all' AND tablename = 'purchase_order_items'
  ) THEN
    EXECUTE 'CREATE POLICY "purchase_order_items_auth_all" ON public.purchase_order_items FOR ALL USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- profiles (common table created via auth trigger, often missing RLS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'profiles_auth_all' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles_auth_all" ON public.profiles FOR ALL USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;
