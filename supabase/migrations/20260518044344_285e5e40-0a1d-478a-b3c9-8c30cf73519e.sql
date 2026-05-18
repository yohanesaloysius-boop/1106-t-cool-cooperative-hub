
-- 1) Enum additions
ALTER TYPE store_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE mp_trx_status ADD VALUE IF NOT EXISTS 'refunded';

-- 2) Complaints table
CREATE TABLE IF NOT EXISTS public.marketplace_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  alasan text NOT NULL,
  lampiran_url text,
  status text NOT NULL DEFAULT 'open', -- open, resolved_refund, resolved_release, rejected
  resolusi text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints view related"
ON public.marketplace_complaints FOR SELECT TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.is_pengurus(auth.uid()));

CREATE POLICY "complaints insert buyer"
ON public.marketplace_complaints FOR INSERT TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "complaints update pengurus"
ON public.marketplace_complaints FOR UPDATE TO authenticated
USING (public.is_pengurus(auth.uid()));

CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON public.marketplace_complaints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) File complaint
CREATE OR REPLACE FUNCTION public.mp_file_complaint(_trx_id uuid, _alasan text, _lampiran_url text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.marketplace_transactions%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO t FROM public.marketplace_transactions WHERE id = _trx_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF t.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF t.status NOT IN ('paid','shipped','completed') THEN
    RAISE EXCEPTION 'Komplain hanya untuk pesanan yang sudah dibayar (%)', t.status;
  END IF;
  INSERT INTO public.marketplace_complaints (trx_id, buyer_id, seller_id, alasan, lampiran_url)
  VALUES (_trx_id, t.buyer_id, t.seller_id, _alasan, _lampiran_url)
  RETURNING id INTO v_id;

  -- Notif pengurus
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  SELECT ur.user_id,
    '⚠️ Komplain baru',
    'Komplain untuk pesanan #' || substr(t.id::text,1,8) || ': ' || left(_alasan, 80),
    'approval', '/admin/komplain', 'marketplace_complaints', v_id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin','ketua','bendahara') AND ur.deleted_at IS NULL;

  -- Notif penjual
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (t.seller_id, '⚠️ Pesanan dikomplain',
    'Pembeli mengajukan komplain untuk pesanan #' || substr(t.id::text,1,8) || '. Menunggu peninjauan pengurus.',
    'peringatan', '/marketplace-saya', 'marketplace_complaints', v_id);

  RETURN v_id;
END $$;

-- 4) Resolve complaint
CREATE OR REPLACE FUNCTION public.mp_resolve_complaint(_complaint_id uuid, _action text, _catatan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.marketplace_complaints%ROWTYPE;
  t public.marketplace_transactions%ROWTYPE;
  v_seller_wallet uuid;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO c FROM public.marketplace_complaints WHERE id = _complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Komplain tidak ditemukan'; END IF;
  IF c.status <> 'open' THEN RAISE EXCEPTION 'Sudah diproses (%)', c.status; END IF;
  SELECT * INTO t FROM public.marketplace_transactions WHERE id = c.trx_id FOR UPDATE;

  IF _action = 'refund' THEN
    -- Kembalikan escrow penjual (kalau masih ditahan)
    IF t.status IN ('paid','shipped') AND t.seller_amount > 0 THEN
      v_seller_wallet := public.get_or_create_wallet(t.seller_id);
      UPDATE public.wallets
        SET saldo_escrow = saldo_escrow - t.seller_amount, updated_at = now()
        WHERE id = v_seller_wallet;
      INSERT INTO public.wallet_transactions
        (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan, created_by)
      VALUES (v_seller_wallet, t.seller_id, 'out', t.seller_amount, 'refund',
              'marketplace_transactions', t.id,
              'Refund komplain pesanan #' || substr(t.id::text,1,8), auth.uid());
    END IF;
    UPDATE public.marketplace_transactions
      SET status='refunded', updated_at=now() WHERE id=t.id;
    UPDATE public.marketplace_complaints
      SET status='resolved_refund', resolusi=_catatan, resolved_by=auth.uid(),
          resolved_at=now(), updated_at=now() WHERE id=_complaint_id;

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id) VALUES
      (c.buyer_id, '✅ Komplain disetujui (refund)',
        'Komplain Anda disetujui. Dana akan dikembalikan. Catatan: ' || COALESCE(_catatan,'-'),
        'sukses', '/transaksi-saya', 'marketplace_complaints', _complaint_id),
      (c.seller_id, '❌ Pesanan di-refund',
        'Pesanan #' || substr(t.id::text,1,8) || ' di-refund ke pembeli. Catatan: ' || COALESCE(_catatan,'-'),
        'peringatan', '/marketplace-saya', 'marketplace_complaints', _complaint_id);

  ELSIF _action = 'reject' THEN
    UPDATE public.marketplace_complaints
      SET status='rejected', resolusi=_catatan, resolved_by=auth.uid(),
          resolved_at=now(), updated_at=now() WHERE id=_complaint_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (c.buyer_id, '❌ Komplain ditolak',
      'Komplain Anda ditolak. Catatan: ' || COALESCE(_catatan,'-'),
      'peringatan', '/transaksi-saya', 'marketplace_complaints', _complaint_id);
  ELSE
    RAISE EXCEPTION 'Aksi tidak valid: %', _action;
  END IF;
END $$;

-- 5) Set store status (verifikasi seller)
CREATE OR REPLACE FUNCTION public.mp_set_store_status(_store_id uuid, _status store_status, _alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member uuid; v_nama text;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT member_id, nama_toko INTO v_member, v_nama FROM public.marketplace_stores WHERE id=_store_id;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Toko tidak ditemukan'; END IF;
  UPDATE public.marketplace_stores SET status_toko=_status, updated_at=now() WHERE id=_store_id;
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (v_member,
    CASE WHEN _status='active' THEN '✅ Toko aktif'
         WHEN _status='pending' THEN '⏳ Toko menunggu verifikasi'
         WHEN _status='suspended' THEN '⛔ Toko ditangguhkan'
         ELSE '📦 Status toko diperbarui' END,
    'Toko "' || v_nama || '" sekarang: ' || _status::text ||
      CASE WHEN _alasan IS NOT NULL THEN '. Catatan: ' || _alasan ELSE '' END,
    CASE WHEN _status='active' THEN 'sukses'
         WHEN _status='suspended' THEN 'peringatan' ELSE 'info' END,
    '/marketplace-saya', 'marketplace_stores', _store_id);
END $$;

-- 6) Admin marketplace stats
CREATE OR REPLACE FUNCTION public.get_marketplace_admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fee numeric; v_escrow numeric; v_gmv numeric;
  v_by_status jsonb; v_completed int; v_pending_verif int; v_open_complaints int;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT COALESCE(saldo,0) INTO v_fee FROM public.wallets WHERE user_id IS NULL;
  SELECT COALESCE(SUM(saldo_escrow),0) INTO v_escrow FROM public.wallets WHERE user_id IS NOT NULL;
  SELECT COALESCE(SUM(total),0) INTO v_gmv FROM public.marketplace_transactions
    WHERE status IN ('paid','shipped','completed');
  SELECT COUNT(*) INTO v_completed FROM public.marketplace_transactions WHERE status='completed';
  SELECT COUNT(*) INTO v_pending_verif FROM public.marketplace_transactions WHERE status='pending' AND bukti_transfer_url IS NOT NULL;
  SELECT COUNT(*) INTO v_open_complaints FROM public.marketplace_complaints WHERE status='open';
  SELECT jsonb_object_agg(status, c) INTO v_by_status FROM (
    SELECT status::text AS status, COUNT(*) AS c FROM public.marketplace_transactions GROUP BY status
  ) s;
  RETURN jsonb_build_object(
    'fee_koperasi', v_fee, 'escrow_total', v_escrow, 'gmv', v_gmv,
    'completed', v_completed, 'pending_verif', v_pending_verif,
    'open_complaints', v_open_complaints, 'by_status', COALESCE(v_by_status,'{}'::jsonb)
  );
END $$;

-- 7) Top products
CREATE OR REPLACE FUNCTION public.get_top_products(_limit int DEFAULT 10)
RETURNS TABLE(product_id uuid, nama_produk text, gambar text, store_nama text, total_qty bigint, total_omset numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nama_produk, COALESCE(p.gambar_produk[1],'') AS gambar, s.nama_toko,
         SUM(t.qty)::bigint AS total_qty, SUM(t.total) AS total_omset
  FROM public.marketplace_transactions t
  JOIN public.marketplace_products p ON p.id = t.product_id
  JOIN public.marketplace_stores s ON s.id = t.store_id
  WHERE t.status IN ('paid','shipped','completed')
  GROUP BY p.id, p.nama_produk, p.gambar_produk, s.nama_toko
  ORDER BY total_qty DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;

-- 8) Fee breakdown per bulan (12 bulan terakhir)
CREATE OR REPLACE FUNCTION public.get_fee_breakdown()
RETURNS TABLE(bulan text, total_fee numeric, total_gmv numeric, jumlah_trx bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH months AS (
    SELECT date_trunc('month', now()) - (i || ' months')::interval AS m
    FROM generate_series(0,11) i
  )
  SELECT to_char(m,'Mon YY') AS bulan,
    COALESCE(SUM(t.fee_nominal),0) AS total_fee,
    COALESCE(SUM(t.total),0) AS total_gmv,
    COUNT(t.id)::bigint AS jumlah_trx
  FROM months
  LEFT JOIN public.marketplace_transactions t
    ON t.status='completed' AND t.received_at >= m AND t.received_at < m + interval '1 month'
  GROUP BY m ORDER BY m;
$$;
