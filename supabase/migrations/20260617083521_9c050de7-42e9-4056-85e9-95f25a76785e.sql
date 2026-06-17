CREATE OR REPLACE FUNCTION public.mp_verify_payment(_trx_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.marketplace_transactions%ROWTYPE;
  v_fee_persen numeric;
  v_fee_nominal numeric;
  v_seller_amount numeric;
  v_seller_wallet uuid;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO t FROM public.marketplace_transactions WHERE id = _trx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF t.status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Status tidak valid (%)', t.status;
  END IF;

  SELECT COALESCE((value)::text::numeric, 5) INTO v_fee_persen
    FROM public.settings WHERE key='marketplace_fee_persen';
  v_fee_persen := COALESCE(v_fee_persen, 5);
  v_fee_nominal := ROUND(COALESCE(t.total,0) * v_fee_persen / 100);
  v_seller_amount := COALESCE(t.total,0) - v_fee_nominal;

  v_seller_wallet := public.get_or_create_wallet(t.seller_id);

  UPDATE public.wallets
    SET saldo_escrow = COALESCE(saldo_escrow,0) + v_seller_amount, updated_at = now()
    WHERE id = v_seller_wallet;

  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan, created_by)
  VALUES (v_seller_wallet, t.seller_id, 'in', v_seller_amount, 'escrow_in',
          'marketplace_transactions', t.id,
          'Dana ditahan dari pesanan #' || substr(t.id::text,1,8), auth.uid());

  UPDATE public.marketplace_transactions
    SET status = 'paid', paid_at = now(), verified_by = auth.uid(),
        fee_persen = v_fee_persen, fee_nominal = v_fee_nominal,
        seller_amount = v_seller_amount, updated_at = now()
    WHERE id = _trx_id;

  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES
    (t.buyer_id, '✅ Pembayaran dikonfirmasi',
     'Pembayaran pesanan #' || substr(t.id::text,1,8) || ' sudah diverifikasi. Penjual akan segera mengirim.',
     'sukses', '/transaksi-saya', 'marketplace_transactions', t.id),
    (t.seller_id, '📦 Pesanan siap dikirim',
     'Pembayaran sudah masuk escrow. Silakan kirim barang dan input nomor resi.',
     'info', '/marketplace-saya', 'marketplace_transactions', t.id);
END $function$;

INSERT INTO public.settings (key, value)
VALUES ('marketplace_fee_persen', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;