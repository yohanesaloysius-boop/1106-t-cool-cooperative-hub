CREATE OR REPLACE FUNCTION public.mp_auto_release_escrow(_days integer DEFAULT 7)
RETURNS TABLE(released_count integer, total_released numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.marketplace_transactions%ROWTYPE;
  v_seller_wallet uuid;
  v_kop_wallet uuid;
  v_count integer := 0;
  v_total numeric := 0;
  v_cutoff timestamptz := now() - (_days || ' days')::interval;
BEGIN
  FOR t IN
    SELECT * FROM public.marketplace_transactions
    WHERE status = 'shipped'
      AND shipped_at IS NOT NULL
      AND shipped_at < v_cutoff
    FOR UPDATE SKIP LOCKED
  LOOP
    v_seller_wallet := public.get_or_create_wallet(t.seller_id);
    v_kop_wallet := public.get_or_create_wallet(NULL);

    UPDATE public.wallets
      SET saldo_escrow = saldo_escrow - t.seller_amount,
          saldo = saldo + t.seller_amount,
          updated_at = now()
      WHERE id = v_seller_wallet;

    INSERT INTO public.wallet_transactions
      (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan)
    VALUES (v_seller_wallet, t.seller_id, 'in', t.seller_amount, 'escrow_release',
            'marketplace_transactions', t.id,
            'Auto-release escrow pesanan #' || substr(t.id::text,1,8));

    IF t.fee_nominal > 0 THEN
      UPDATE public.wallets SET saldo = saldo + t.fee_nominal, updated_at = now()
        WHERE id = v_kop_wallet;
      INSERT INTO public.wallet_transactions
        (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan)
      VALUES (v_kop_wallet, NULL, 'in', t.fee_nominal, 'fee',
              'marketplace_transactions', t.id,
              'Fee marketplace (auto) #' || substr(t.id::text,1,8));
    END IF;

    UPDATE public.marketplace_transactions
      SET status='completed', received_at=now(), updated_at=now()
      WHERE id = t.id;

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (t.seller_id, '💸 Dana cair otomatis ke saldo',
            'Pesanan #' || substr(t.id::text,1,8) || ' auto-release setelah ' || _days || ' hari. Rp ' ||
            to_char(t.seller_amount,'FM999G999G999') || ' masuk ke saldo.',
            'sukses', '/marketplace-saya', 'marketplace_transactions', t.id);

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (t.buyer_id, 'Pesanan otomatis diselesaikan',
            'Pesanan #' || substr(t.id::text,1,8) || ' otomatis diselesaikan setelah ' || _days || ' hari sejak pengiriman.',
            'info', '/transaksi-saya', 'marketplace_transactions', t.id);

    v_count := v_count + 1;
    v_total := v_total + t.seller_amount;
  END LOOP;

  RETURN QUERY SELECT v_count, v_total;
END $$;

INSERT INTO public.settings (key, value, description, is_public)
VALUES ('marketplace_auto_release_days', '7'::jsonb, 'Jumlah hari setelah pengiriman sebelum escrow dilepas otomatis ke penjual', false)
ON CONFLICT (key) DO NOTHING;