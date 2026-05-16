
-- ============================================================
-- Marketplace ↔ Koperasi integration
-- ============================================================

-- 1) Public RPC: marketplace stats (anon readable, aggregate only)
CREATE OR REPLACE FUNCTION public.get_marketplace_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_toko int;
  v_produk int;
  v_trx int;
  v_gmv numeric;
BEGIN
  SELECT COUNT(*) INTO v_toko FROM public.marketplace_stores WHERE status_toko = 'active';
  SELECT COUNT(*) INTO v_produk FROM public.marketplace_products WHERE status_produk = 'active';
  SELECT COUNT(*) INTO v_trx FROM public.marketplace_transactions;
  SELECT COALESCE(SUM(total),0) INTO v_gmv
    FROM public.marketplace_transactions
    WHERE status IN ('completed','paid','shipped');
  RETURN jsonb_build_object(
    'toko_aktif', v_toko,
    'produk_aktif', v_produk,
    'transaksi_total', v_trx,
    'gmv', v_gmv
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_stats() TO anon, authenticated;

-- 2) Public RPC: featured products
CREATE OR REPLACE FUNCTION public.get_featured_products(_limit int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  nama_produk text,
  slug text,
  harga numeric,
  diskon_persen int,
  gambar_produk text[],
  store_id uuid,
  store_nama text,
  store_slug text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nama_produk, p.slug, p.harga, p.diskon_persen, p.gambar_produk,
         s.id AS store_id, s.nama_toko AS store_nama, s.slug AS store_slug
  FROM public.marketplace_products p
  JOIN public.marketplace_stores s ON s.id = p.store_id
  WHERE p.status_produk = 'active'
    AND s.status_toko = 'active'
    AND p.is_featured = true
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 24));
$$;

GRANT EXECUTE ON FUNCTION public.get_featured_products(int) TO anon, authenticated;

-- 3) Seller badge check
CREATE OR REPLACE FUNCTION public.is_active_seller(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_stores s
    JOIN public.marketplace_products p ON p.store_id = s.id
    WHERE s.member_id = _user_id
      AND s.status_toko = 'active'
      AND p.status_produk = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_seller(uuid) TO anon, authenticated;

-- 4) Notification trigger: new transaction → notify seller
CREATE OR REPLACE FUNCTION public.notify_marketplace_trx()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nama text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nama_produk INTO v_nama FROM public.marketplace_products WHERE id = NEW.product_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.seller_id,
      '🛒 Pesanan baru masuk',
      'Ada pesanan baru untuk produk: ' || COALESCE(v_nama,'(produk)') || ' — ' || NEW.qty || ' pcs. Segera proses ya!',
      'info',
      '/marketplace-saya',
      'marketplace_transactions',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT nama_produk INTO v_nama FROM public.marketplace_products WHERE id = NEW.product_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.buyer_id,
      '📦 Status pesanan diperbarui',
      'Pesanan "' || COALESCE(v_nama,'(produk)') || '" sekarang: ' || NEW.status,
      CASE WHEN NEW.status = 'completed' THEN 'sukses'
           WHEN NEW.status = 'cancelled' THEN 'peringatan'
           ELSE 'info' END,
      '/dashboard-belanja',
      'marketplace_transactions',
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_marketplace_trx_ins ON public.marketplace_transactions;
CREATE TRIGGER trg_notify_marketplace_trx_ins
  AFTER INSERT ON public.marketplace_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_marketplace_trx();

DROP TRIGGER IF EXISTS trg_notify_marketplace_trx_upd ON public.marketplace_transactions;
CREATE TRIGGER trg_notify_marketplace_trx_upd
  AFTER UPDATE ON public.marketplace_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_marketplace_trx();

-- 5) Extend public activity feed to include marketplace transactions
CREATE OR REPLACE FUNCTION public.get_public_recent_activity(limit_count integer DEFAULT 6)
RETURNS TABLE(kind text, title text, descr text, ts timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH unioned AS (
    SELECT 'member'::text AS kind,
           'Anggota baru bergabung'::text AS title,
           ('Anggota ' || COALESCE(nomor_anggota, 'baru') || ' mendaftar')::text AS descr,
           created_at AS ts
    FROM public.profiles WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'simpanan', 'Setor simpanan', ('Setoran ' || jenis::text), created_at
    FROM public.simpanan WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'pinjaman', 'Pengajuan pinjaman', ('Status: ' || status::text), created_at
    FROM public.pinjaman WHERE deleted_at IS NULL
    UNION ALL
    SELECT 'marketplace', 'Transaksi marketplace',
           ('Order ' || qty::text || ' pcs — status: ' || status::text), created_at
    FROM public.marketplace_transactions
  )
  SELECT * FROM unioned ORDER BY ts DESC LIMIT limit_count;
$$;
