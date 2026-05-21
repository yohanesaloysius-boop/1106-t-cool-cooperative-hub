
-- ============================================
-- K2: Avatars storage — scope by user folder
-- ============================================
DROP POLICY IF EXISTS "avatars authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "avatars authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars authenticated upload" ON storage.objects;

CREATE POLICY "avatars upload own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "avatars update own folder" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "avatars delete own folder" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- K3: lowongan_kerja — hide contact from anon
-- Public view exposing only safe columns; restrict table to authenticated.
-- ============================================
DROP POLICY IF EXISTS "Approved lowongan public read" ON public.lowongan_kerja;

CREATE POLICY "Approved lowongan authenticated read"
ON public.lowongan_kerja
FOR SELECT TO authenticated
USING (status = 'approved'::lowongan_status);

-- Safe public view (no kontak_telepon / kontak_email)
CREATE OR REPLACE VIEW public.lowongan_kerja_public
WITH (security_invoker = true) AS
SELECT
  id, judul, perusahaan, deskripsi, posisi, gender, lokasi,
  kontak_nama, status, expired_at, created_at
FROM public.lowongan_kerja
WHERE status = 'approved'::lowongan_status;

GRANT SELECT ON public.lowongan_kerja_public TO anon, authenticated;

-- Allow anon to read the view via underlying table policy
CREATE POLICY "Approved lowongan anon read (no contact)"
ON public.lowongan_kerja
FOR SELECT TO anon
USING (status = 'approved'::lowongan_status);
-- Note: anon can still query base table; mitigation is column-level revoke:
REVOKE SELECT ON public.lowongan_kerja FROM anon;
GRANT SELECT (id, judul, perusahaan, deskripsi, posisi, gender, lokasi,
              kontak_nama, status, expired_at, created_at)
  ON public.lowongan_kerja TO anon;

-- ============================================
-- K1: qris_mark_success — only pengurus can mark success
-- Removes member self-mark (was IDOR-risky in production)
-- ============================================
CREATE OR REPLACE FUNCTION public.qris_mark_success(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.qris_payments%ROWTYPE;
  v_wallet UUID;
  v_jenis_simp public.simpanan_jenis;
  v_new_simp_id UUID;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya pengurus yang dapat menandai pembayaran berhasil';
  END IF;

  SELECT * INTO p FROM public.qris_payments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;

  IF p.status <> 'pending' THEN
    RAISE EXCEPTION 'Status bukan pending (%)', p.status;
  END IF;
  IF p.expired_at < now() THEN
    UPDATE public.qris_payments SET status='expired', updated_at=now() WHERE id=_id;
    RAISE EXCEPTION 'Transaksi sudah kedaluwarsa';
  END IF;

  UPDATE public.qris_payments
    SET status='success', paid_at=now(), updated_at=now()
    WHERE id=_id;

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

  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  VALUES (p.user_id,
    '✅ Pembayaran QRIS berhasil',
    'Pembayaran ' || p.invoice_no || ' sebesar Rp ' ||
      to_char(p.nominal,'FM999G999G999') || ' (' || p.jenis::text || ') telah diterima.',
    'sukses', '/bayar-qris', 'qris_payments', p.id);
END $function$;

-- ============================================
-- K5: Hardening RPC grants — ensure approve_member only pengurus can call
-- (Function body already checks; revoke direct execution from anon to be safe)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.approve_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.qris_mark_success(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mp_verify_payment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mp_process_withdrawal(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mp_reject_withdrawal(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mp_resolve_complaint(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mp_set_store_status(uuid, store_status, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mp_review_loan_verification(uuid, text, text) FROM anon;
