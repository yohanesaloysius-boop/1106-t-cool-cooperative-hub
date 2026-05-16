
-- Attach existing notify function as trigger on marketplace_transactions
DROP TRIGGER IF EXISTS trg_notify_mp_trx ON public.marketplace_transactions;
CREATE TRIGGER trg_notify_mp_trx
AFTER INSERT OR UPDATE ON public.marketplace_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_marketplace_trx();

-- Enable realtime on relevant tables (ignore if already added)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_transactions';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Helper: recent marketplace activity for a user (as buyer OR seller)
CREATE OR REPLACE FUNCTION public.get_user_marketplace_activity(_user_id uuid, _limit int DEFAULT 6)
RETURNS TABLE (
  id uuid,
  role text,
  status text,
  qty int,
  total numeric,
  created_at timestamptz,
  product_id uuid,
  nama_produk text,
  gambar text,
  store_id uuid,
  store_nama text,
  store_slug text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    CASE WHEN t.buyer_id = _user_id THEN 'buyer' ELSE 'seller' END AS role,
    t.status::text AS status,
    t.qty,
    t.total,
    t.created_at,
    p.id AS product_id,
    p.nama_produk,
    COALESCE(p.gambar_produk[1], '') AS gambar,
    s.id AS store_id,
    s.nama_toko AS store_nama,
    s.slug AS store_slug
  FROM public.marketplace_transactions t
  JOIN public.marketplace_products p ON p.id = t.product_id
  JOIN public.marketplace_stores s ON s.id = t.store_id
  WHERE t.buyer_id = _user_id OR t.seller_id = _user_id
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 20));
$$;
