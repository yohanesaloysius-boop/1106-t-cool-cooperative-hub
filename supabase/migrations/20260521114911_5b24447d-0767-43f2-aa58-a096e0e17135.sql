
-- Enum jenis & status
CREATE TYPE public.qris_jenis AS ENUM ('simpanan','angsuran','topup','marketplace','admin','ppob');
CREATE TYPE public.qris_status AS ENUM ('pending','success','expired','failed','cancelled');

-- Sequence untuk nomor invoice
CREATE SEQUENCE public.qris_invoice_seq START 1;

CREATE OR REPLACE FUNCTION public.gen_qris_invoice_no()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.qris_invoice_seq');
  RETURN 'TCQR-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(n::text, 5, '0');
END $$;

-- Tabel utama
CREATE TABLE public.qris_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE DEFAULT public.gen_qris_invoice_no(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jenis public.qris_jenis NOT NULL,
  nominal NUMERIC(15,2) NOT NULL CHECK (nominal > 0),
  status public.qris_status NOT NULL DEFAULT 'pending',
  qr_string TEXT NOT NULL,
  keterangan TEXT,
  ref_table TEXT,
  ref_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expired_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qris_user ON public.qris_payments(user_id, created_at DESC);
CREATE INDEX idx_qris_status ON public.qris_payments(status, expired_at);

ALTER TABLE public.qris_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qris_select_own_or_admin" ON public.qris_payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));

CREATE POLICY "qris_insert_own" ON public.qris_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "qris_update_admin" ON public.qris_payments
  FOR UPDATE USING (public.is_pengurus(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER set_qris_updated_at BEFORE UPDATE ON public.qris_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-expire pending payments (cron-style helper)
CREATE OR REPLACE FUNCTION public.qris_expire_pending()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.qris_payments
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending' AND expired_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Mark payment success (mock simulator) + auto-jurnal sesuai jenis
CREATE OR REPLACE FUNCTION public.qris_mark_success(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.qris_payments%ROWTYPE;
  v_wallet UUID;
  v_jenis_simp public.simpanan_jenis;
  v_new_simp_id UUID;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN
    -- Untuk mode mock, izinkan user sendiri menyimulasikan pembayarannya
    SELECT * INTO p FROM public.qris_payments WHERE id = _id FOR UPDATE;
    IF NOT FOUND OR p.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Akses ditolak';
    END IF;
  ELSE
    SELECT * INTO p FROM public.qris_payments WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  END IF;

  IF p.status <> 'pending' THEN
    RAISE EXCEPTION 'Status bukan pending (%)', p.status;
  END IF;
  IF p.expired_at < now() THEN
    UPDATE public.qris_payments SET status='expired', updated_at=now() WHERE id=_id;
    RAISE EXCEPTION 'Transaksi sudah kedaluwarsa';
  END IF;

  -- Tandai sukses dulu (anti double payment via FOR UPDATE + status check)
  UPDATE public.qris_payments
    SET status='success', paid_at=now(), updated_at=now()
    WHERE id=_id;

  -- Eksekusi efek samping sesuai jenis
  IF p.jenis = 'simpanan' THEN
    v_jenis_simp := COALESCE((p.metadata->>'jenis_simpanan')::public.simpanan_jenis, 'sukarela');
    INSERT INTO public.simpanan (user_id, jenis, nominal, status, bukti_url, verified_at)
    VALUES (p.user_id, v_jenis_simp, p.nominal, 'verified', 'qris://' || p.invoice_no, now())
    RETURNING id INTO v_new_simp_id;
    UPDATE public.qris_payments SET ref_table='simpanan', ref_id=v_new_simp_id WHERE id=_id;

  ELSIF p.jenis = 'angsuran' AND p.ref_id IS NOT NULL THEN
    UPDATE public.angsuran
      SET status='paid', paid_at=now(), bukti_url='qris://' || p.invoice_no
      WHERE id=p.ref_id AND status IN ('unpaid','overdue');

  ELSIF p.jenis = 'topup' THEN
    v_wallet := public.get_or_create_wallet(p.user_id);
    UPDATE public.wallets SET saldo = saldo + p.nominal, updated_at=now() WHERE id=v_wallet;
    INSERT INTO public.wallet_transactions
      (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan)
    VALUES (v_wallet, p.user_id, 'in', p.nominal, 'topup',
            'qris_payments', p.id, 'Topup via QRIS ' || p.invoice_no);

  ELSIF p.jenis = 'marketplace' AND p.ref_id IS NOT NULL THEN
    UPDATE public.marketplace_transactions
      SET status='confirmed', bukti_transfer_url='qris://' || p.invoice_no, updated_at=now()
      WHERE id=p.ref_id AND status='pending';
  END IF;

  -- Notifikasi sukses
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (p.user_id,
    '✅ Pembayaran QRIS berhasil',
    'Pembayaran ' || p.invoice_no || ' sebesar Rp ' ||
      to_char(p.nominal,'FM999G999G999') || ' (' || p.jenis::text || ') telah diterima.',
    'sukses', '/bayar-qris', 'qris_payments', p.id);
END $$;

-- Aktifkan realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.qris_payments;
ALTER TABLE public.qris_payments REPLICA IDENTITY FULL;
