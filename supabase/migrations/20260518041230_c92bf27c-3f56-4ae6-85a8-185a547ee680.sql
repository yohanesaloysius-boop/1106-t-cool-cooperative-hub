
-- ============================================
-- 1. EXTEND marketplace_transactions
-- ============================================
ALTER TABLE public.marketplace_transactions
  ADD COLUMN IF NOT EXISTS bukti_transfer_url text,
  ADD COLUMN IF NOT EXISTS fee_persen numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS fee_nominal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resi text,
  ADD COLUMN IF NOT EXISTS kurir text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

-- ============================================
-- 2. WALLETS (per seller + 1 koperasi)
-- ============================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE, -- NULL = dompet koperasi
  saldo numeric NOT NULL DEFAULT 0,
  saldo_escrow numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_koperasi_one
  ON public.wallets ((1)) WHERE user_id IS NULL;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets view own or pengurus" ON public.wallets;
CREATE POLICY "wallets view own or pengurus" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_pengurus(auth.uid()));

DROP POLICY IF EXISTS "wallets pengurus manage" ON public.wallets;
CREATE POLICY "wallets pengurus manage" ON public.wallets
  FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid()))
  WITH CHECK (public.is_pengurus(auth.uid()));

CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 3. WALLET LEDGER
-- ============================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid,
  arah text NOT NULL CHECK (arah IN ('in','out')),
  nominal numeric NOT NULL,
  jenis text NOT NULL, -- escrow_in, escrow_release, fee, withdraw, refund, manual
  ref_table text,
  ref_id uuid,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS wtrx_user_idx ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wtrx_wallet_idx ON public.wallet_transactions(wallet_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wtrx view own or pengurus" ON public.wallet_transactions;
CREATE POLICY "wtrx view own or pengurus" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_pengurus(auth.uid()));

DROP POLICY IF EXISTS "wtrx pengurus insert" ON public.wallet_transactions;
CREATE POLICY "wtrx pengurus insert" ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_pengurus(auth.uid()));

-- ============================================
-- 4. WITHDRAWALS
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','rejected','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nominal numeric NOT NULL CHECK (nominal > 0),
  bank_nama text,
  bank_no_rek text,
  bank_atas_nama text,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  catatan text,
  bukti_transfer_url text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wd view own or pengurus" ON public.marketplace_withdrawals;
CREATE POLICY "wd view own or pengurus" ON public.marketplace_withdrawals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_pengurus(auth.uid()));

DROP POLICY IF EXISTS "wd insert own" ON public.marketplace_withdrawals;
CREATE POLICY "wd insert own" ON public.marketplace_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "wd update own pending" ON public.marketplace_withdrawals;
CREATE POLICY "wd update own pending" ON public.marketplace_withdrawals
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "wd pengurus update" ON public.marketplace_withdrawals;
CREATE POLICY "wd pengurus update" ON public.marketplace_withdrawals
  FOR UPDATE TO authenticated
  USING (public.is_pengurus(auth.uid()));

CREATE TRIGGER wd_updated_at BEFORE UPDATE ON public.marketplace_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 5. SETTINGS DEFAULT
-- ============================================
INSERT INTO public.settings (key, value, description, is_public)
  VALUES ('marketplace_fee_persen', '5'::jsonb, 'Fee marketplace koperasi (%)', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, description, is_public)
  VALUES ('marketplace_rekening',
    '{"bank":"BCA","no_rek":"1234567890","atas_nama":"Koperasi T-COOL"}'::jsonb,
    'Rekening tujuan transfer pembeli marketplace', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 6. FUNCTIONS
-- ============================================

-- Ensure wallet exists (returns wallet id)
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    SELECT id INTO v_id FROM public.wallets WHERE user_id IS NULL;
    IF v_id IS NULL THEN
      INSERT INTO public.wallets (user_id) VALUES (NULL) RETURNING id INTO v_id;
    END IF;
  ELSE
    SELECT id INTO v_id FROM public.wallets WHERE user_id = _user_id;
    IF v_id IS NULL THEN
      INSERT INTO public.wallets (user_id) VALUES (_user_id) RETURNING id INTO v_id;
    END IF;
  END IF;
  RETURN v_id;
END $$;

-- Buyer uploads bukti transfer (after creating trx)
CREATE OR REPLACE FUNCTION public.mp_upload_bukti(_trx_id uuid, _bukti_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.marketplace_transactions%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.marketplace_transactions WHERE id = _trx_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF t.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF t.status <> 'pending' THEN
    RAISE EXCEPTION 'Bukti hanya bisa diupload saat status pending (sekarang: %)', t.status;
  END IF;
  UPDATE public.marketplace_transactions
    SET bukti_transfer_url = _bukti_url, updated_at = now()
    WHERE id = _trx_id;

  -- Notify pengurus
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  SELECT ur.user_id,
         '💰 Bukti transfer baru',
         'Pembeli mengirim bukti pembayaran untuk pesanan #' || substr(t.id::text,1,8) ||
           '. Mohon verifikasi.',
         'approval', '/admin/marketplace',
         'marketplace_transactions', t.id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin','ketua','bendahara') AND ur.deleted_at IS NULL;
END $$;

-- Pengurus verify payment → masuk escrow
CREATE OR REPLACE FUNCTION public.mp_verify_payment(_trx_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  v_fee_nominal := ROUND(t.total * v_fee_persen / 100);
  v_seller_amount := t.total - v_fee_nominal;

  v_seller_wallet := public.get_or_create_wallet(t.seller_id);

  UPDATE public.wallets
    SET saldo_escrow = saldo_escrow + v_seller_amount, updated_at = now()
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

  -- Notify buyer & seller
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES
    (t.buyer_id, '✅ Pembayaran dikonfirmasi',
     'Pembayaran pesanan #' || substr(t.id::text,1,8) || ' sudah diverifikasi. Penjual akan segera mengirim.',
     'sukses', '/transaksi-saya', 'marketplace_transactions', t.id),
    (t.seller_id, '📦 Pesanan siap dikirim',
     'Pembayaran sudah masuk escrow. Silakan kirim barang dan input nomor resi.',
     'info', '/marketplace-saya', 'marketplace_transactions', t.id);
END $$;

-- Seller input resi → status shipped
CREATE OR REPLACE FUNCTION public.mp_ship(_trx_id uuid, _resi text, _kurir text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.marketplace_transactions%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.marketplace_transactions WHERE id = _trx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF t.seller_id <> auth.uid() AND NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF t.status <> 'paid' THEN
    RAISE EXCEPTION 'Pesanan belum dibayar / sudah dikirim (%)', t.status;
  END IF;
  UPDATE public.marketplace_transactions
    SET status='shipped', resi=_resi, kurir=_kurir, shipped_at=now(), updated_at=now()
    WHERE id=_trx_id;

  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (t.buyer_id, '🚚 Pesanan dikirim',
          'Pesanan #' || substr(t.id::text,1,8) || ' dikirim via ' || COALESCE(_kurir,'-') ||
          ' (resi: ' || COALESCE(_resi,'-') || '). Klik "Konfirmasi Terima" setelah barang sampai.',
          'info', '/transaksi-saya', 'marketplace_transactions', t.id);
END $$;

-- Buyer confirms received → cair ke seller, fee ke koperasi
CREATE OR REPLACE FUNCTION public.mp_confirm_received(_trx_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.marketplace_transactions%ROWTYPE;
  v_seller_wallet uuid;
  v_kop_wallet uuid;
BEGIN
  SELECT * INTO t FROM public.marketplace_transactions WHERE id = _trx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF t.buyer_id <> auth.uid() AND NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF t.status NOT IN ('paid','shipped') THEN
    RAISE EXCEPTION 'Pesanan belum siap dikonfirmasi (%)', t.status;
  END IF;

  v_seller_wallet := public.get_or_create_wallet(t.seller_id);
  v_kop_wallet := public.get_or_create_wallet(NULL);

  UPDATE public.wallets
    SET saldo_escrow = saldo_escrow - t.seller_amount,
        saldo = saldo + t.seller_amount,
        updated_at = now()
    WHERE id = v_seller_wallet;

  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan, created_by)
  VALUES (v_seller_wallet, t.seller_id, 'in', t.seller_amount, 'escrow_release',
          'marketplace_transactions', t.id,
          'Pencairan escrow pesanan #' || substr(t.id::text,1,8), auth.uid());

  IF t.fee_nominal > 0 THEN
    UPDATE public.wallets SET saldo = saldo + t.fee_nominal, updated_at = now()
      WHERE id = v_kop_wallet;
    INSERT INTO public.wallet_transactions
      (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan, created_by)
    VALUES (v_kop_wallet, NULL, 'in', t.fee_nominal, 'fee',
            'marketplace_transactions', t.id,
            'Fee marketplace pesanan #' || substr(t.id::text,1,8), auth.uid());
  END IF;

  UPDATE public.marketplace_transactions
    SET status='completed', received_at=now(), updated_at=now()
    WHERE id=_trx_id;

  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (t.seller_id, '💸 Dana cair ke saldo Anda',
          'Pesanan #' || substr(t.id::text,1,8) || ' selesai. Rp ' ||
          to_char(t.seller_amount,'FM999G999G999') || ' masuk ke saldo. Bisa diajukan pencairan.',
          'sukses', '/marketplace-saya', 'marketplace_transactions', t.id);
END $$;

-- Pengurus process withdrawal
CREATE OR REPLACE FUNCTION public.mp_process_withdrawal(_wd_id uuid, _bukti_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.marketplace_withdrawals%ROWTYPE;
  v_wallet uuid;
  v_saldo numeric;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO w FROM public.marketplace_withdrawals WHERE id = _wd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdraw tidak ditemukan'; END IF;
  IF w.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Status tidak valid (%)', w.status;
  END IF;
  v_wallet := public.get_or_create_wallet(w.user_id);
  SELECT saldo INTO v_saldo FROM public.wallets WHERE id = v_wallet FOR UPDATE;
  IF v_saldo < w.nominal THEN RAISE EXCEPTION 'Saldo tidak cukup (saldo: %, diminta: %)', v_saldo, w.nominal; END IF;

  UPDATE public.wallets SET saldo = saldo - w.nominal, updated_at = now() WHERE id = v_wallet;
  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan, created_by)
  VALUES (v_wallet, w.user_id, 'out', w.nominal, 'withdraw',
          'marketplace_withdrawals', w.id,
          'Pencairan ke ' || COALESCE(w.bank_nama,'') || ' ' || COALESCE(w.bank_no_rek,''),
          auth.uid());
  UPDATE public.marketplace_withdrawals
    SET status='paid', processed_at=now(), processed_by=auth.uid(),
        bukti_transfer_url=_bukti_url, updated_at=now()
    WHERE id=_wd_id;

  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (w.user_id, '💸 Pencairan berhasil',
          'Pencairan Rp ' || to_char(w.nominal,'FM999G999G999') || ' sudah ditransfer ke rekening Anda.',
          'sukses', '/marketplace-saya', 'marketplace_withdrawals', w.id);
END $$;

-- Pengurus reject withdrawal
CREATE OR REPLACE FUNCTION public.mp_reject_withdrawal(_wd_id uuid, _alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.marketplace_withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO w FROM public.marketplace_withdrawals WHERE id = _wd_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tidak ditemukan'; END IF;
  IF w.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Tidak bisa ditolak (%)', w.status;
  END IF;
  UPDATE public.marketplace_withdrawals
    SET status='rejected', processed_at=now(), processed_by=auth.uid(),
        catatan=COALESCE(_alasan, catatan), updated_at=now()
    WHERE id=_wd_id;

  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (w.user_id, '❌ Pencairan ditolak',
          'Pengajuan pencairan Rp ' || to_char(w.nominal,'FM999G999G999') ||
          ' ditolak. Alasan: ' || COALESCE(_alasan,'-'),
          'peringatan', '/marketplace-saya', 'marketplace_withdrawals', w.id);
END $$;
