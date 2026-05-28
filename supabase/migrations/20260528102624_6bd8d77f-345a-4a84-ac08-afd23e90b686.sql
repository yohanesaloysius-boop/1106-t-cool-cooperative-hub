
-- =====================================================================
-- HARDENING TAHAP 1: Revoke EXECUTE pada SECURITY DEFINER dari anon/public
-- =====================================================================

-- 1) Cabut semua EXECUTE dari PUBLIC pada fungsi SECURITY DEFINER
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.name, r.args);
  END LOOP;
END $$;

-- 2) Grant EXECUTE ke authenticated untuk semua fungsi SECURITY DEFINER non-trigger
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND t.typname <> 'trigger'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
                   r.name, r.args);
  END LOOP;
END $$;

-- 3) Izinkan kembali anon HANYA untuk fungsi yang memang dirancang publik
-- Login via HP butuh resolve email tanpa sesi
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;
-- Landing page public stats
GRANT EXECUTE ON FUNCTION public.get_public_koperasi_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_recent_activity(integer) TO anon, authenticated;
-- Marketplace browsing publik
GRANT EXECUTE ON FUNCTION public.get_featured_products(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_view(uuid) TO anon, authenticated;
-- Helper normalisasi nomor HP (dipanggil oleh form daftar/login publik)
GRANT EXECUTE ON FUNCTION public.normalize_phone_id(text) TO anon, authenticated;
