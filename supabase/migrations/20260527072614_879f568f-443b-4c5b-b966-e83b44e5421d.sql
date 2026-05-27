
-- 1. Tighten permissive audit insert policies
DROP POLICY IF EXISTS "audit insert auth" ON public.church_pr_audit;
CREATE POLICY "audit insert auth" ON public.church_pr_audit
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "saudit insert auth" ON public.school_pr_audit;
CREATE POLICY "saudit insert auth" ON public.school_pr_audit
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Enable realtime for key tables (idempotent)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'notifications',
    'marketplace_transactions',
    'simpanan',
    'pinjaman',
    'angsuran'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN NULL;
    END;
  END LOOP;
END $$;
