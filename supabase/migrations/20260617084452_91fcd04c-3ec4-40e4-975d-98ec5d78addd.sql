CREATE OR REPLACE FUNCTION public.notify_marketplace_trx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nama text;
  v_kategori public.notif_kategori;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nama_produk INTO v_nama FROM public.marketplace_products WHERE id = NEW.product_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.seller_id,
      '🛒 Pesanan baru masuk',
      'Ada pesanan baru untuk produk: ' || COALESCE(v_nama,'(produk)') || ' — ' || NEW.qty || ' pcs. Segera proses ya!',
      'info'::public.notif_kategori,
      '/marketplace-saya',
      'marketplace_transactions',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT nama_produk INTO v_nama FROM public.marketplace_products WHERE id = NEW.product_id;
    v_kategori := CASE
      WHEN NEW.status = 'completed' THEN 'sukses'::public.notif_kategori
      WHEN NEW.status = 'cancelled' THEN 'peringatan'::public.notif_kategori
      ELSE 'info'::public.notif_kategori
    END;

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.buyer_id,
      '📦 Status pesanan diperbarui',
      'Pesanan "' || COALESCE(v_nama,'(produk)') || '" sekarang: ' || NEW.status,
      v_kategori,
      '/dashboard-belanja',
      'marketplace_transactions',
      NEW.id
    );
  END IF;
  RETURN NEW;
END
$function$;