
-- ===== Loan guarantors =====
CREATE TYPE guarantor_status AS ENUM ('pending','approved','rejected','expired','cancelled');

CREATE TABLE public.loan_guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pinjaman_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  guarantor_id uuid NOT NULL,
  guarantee_amount numeric NOT NULL DEFAULT 0,
  status guarantor_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  rejected_reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  catatan text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pinjaman_id, guarantor_id)
);

CREATE INDEX idx_lg_borrower ON public.loan_guarantors(borrower_id);
CREATE INDEX idx_lg_guarantor ON public.loan_guarantors(guarantor_id);
CREATE INDEX idx_lg_pinjaman ON public.loan_guarantors(pinjaman_id);

ALTER TABLE public.loan_guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lg view related or pengurus" ON public.loan_guarantors
  FOR SELECT TO authenticated
  USING (borrower_id = auth.uid() OR guarantor_id = auth.uid() OR public.is_pengurus(auth.uid()));

CREATE POLICY "lg insert by borrower or pengurus" ON public.loan_guarantors
  FOR INSERT TO authenticated
  WITH CHECK (borrower_id = auth.uid() OR public.is_pengurus(auth.uid()));

CREATE POLICY "lg update by guarantor borrower pengurus" ON public.loan_guarantors
  FOR UPDATE TO authenticated
  USING (guarantor_id = auth.uid() OR borrower_id = auth.uid() OR public.is_pengurus(auth.uid()));

CREATE TRIGGER trg_lg_updated BEFORE UPDATE ON public.loan_guarantors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Default settings =====
INSERT INTO public.settings (key, value, description, is_public) VALUES
  ('guarantor_threshold_1', '5000000'::jsonb, 'Pinjaman ≥ nominal ini wajib N penjamin (tier 1)', true),
  ('guarantor_required_1', '2'::jsonb, 'Jumlah penjamin wajib untuk tier 1', true),
  ('guarantor_threshold_2', '10000000'::jsonb, 'Pinjaman ≥ nominal ini wajib N penjamin (tier 2)', true),
  ('guarantor_required_2', '4'::jsonb, 'Jumlah penjamin wajib untuk tier 2', true),
  ('guarantor_max_active', '3'::jsonb, 'Maksimum pinjaman aktif yang dijamin per anggota', true),
  ('guarantor_max_total_exposure', '20000000'::jsonb, 'Total tanggungan aktif maksimum per anggota', true)
ON CONFLICT (key) DO NOTHING;

-- ===== Validate guarantor =====
CREATE OR REPLACE FUNCTION public.validate_guarantor(_guarantor_id uuid, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status member_status;
  v_overdue int;
  v_active_count int;
  v_total_exposure numeric;
  v_max_active int;
  v_max_exposure numeric;
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  SELECT status INTO v_status FROM public.profiles WHERE id = _guarantor_id AND deleted_at IS NULL;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reasons', ARRAY['Anggota tidak ditemukan']);
  END IF;
  IF v_status <> 'active' THEN
    v_reasons := array_append(v_reasons, 'Anggota tidak aktif');
  END IF;

  SELECT COUNT(*) INTO v_overdue FROM public.angsuran
    WHERE user_id = _guarantor_id AND status IN ('overdue','unpaid') AND jatuh_tempo < CURRENT_DATE;
  IF v_overdue > 0 THEN
    v_reasons := array_append(v_reasons, 'Memiliki ' || v_overdue || ' angsuran terlambat');
  END IF;

  SELECT COALESCE((value)::text::int, 3) INTO v_max_active FROM public.settings WHERE key = 'guarantor_max_active';
  SELECT COALESCE((value)::text::numeric, 20000000) INTO v_max_exposure FROM public.settings WHERE key = 'guarantor_max_total_exposure';

  SELECT COUNT(*), COALESCE(SUM(guarantee_amount),0) INTO v_active_count, v_total_exposure
    FROM public.loan_guarantors lg
    JOIN public.pinjaman p ON p.id = lg.pinjaman_id
    WHERE lg.guarantor_id = _guarantor_id
      AND lg.status IN ('pending','approved')
      AND p.status NOT IN ('rejected','closed','paid_off');

  IF v_active_count >= v_max_active THEN
    v_reasons := array_append(v_reasons, 'Sudah menjamin ' || v_active_count || ' pinjaman (maks ' || v_max_active || ')');
  END IF;
  IF (v_total_exposure + COALESCE(_amount,0)) > v_max_exposure THEN
    v_reasons := array_append(v_reasons,
      'Total tanggungan melebihi limit Rp ' || to_char(v_max_exposure,'FM999G999G999'));
  END IF;

  RETURN jsonb_build_object(
    'ok', array_length(v_reasons,1) IS NULL,
    'reasons', COALESCE(v_reasons, ARRAY[]::text[]),
    'active_count', v_active_count,
    'total_exposure', v_total_exposure,
    'max_active', v_max_active,
    'max_exposure', v_max_exposure
  );
END $$;

-- ===== Act on guarantor request =====
CREATE OR REPLACE FUNCTION public.act_on_guarantor_request(_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.loan_guarantors%ROWTYPE;
  v_borrower_nama text;
  v_guarantor_nama text;
BEGIN
  SELECT * INTO g FROM public.loan_guarantors WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak ditemukan'; END IF;
  IF g.guarantor_id <> auth.uid() AND NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF g.status <> 'pending' THEN
    RAISE EXCEPTION 'Permintaan sudah diproses (%)', g.status;
  END IF;

  SELECT nama_lengkap INTO v_borrower_nama FROM public.profiles WHERE id = g.borrower_id;
  SELECT nama_lengkap INTO v_guarantor_nama FROM public.profiles WHERE id = g.guarantor_id;

  IF _action = 'approve' THEN
    UPDATE public.loan_guarantors
      SET status='approved', responded_at=now(), rejected_reason=NULL, updated_at=now()
      WHERE id=_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (g.borrower_id, '✅ Penjamin menyetujui',
      COALESCE(v_guarantor_nama,'Anggota') || ' menyetujui menjadi penjamin pinjaman Anda.',
      'sukses', '/pinjaman', 'loan_guarantors', g.id);
  ELSIF _action = 'reject' THEN
    UPDATE public.loan_guarantors
      SET status='rejected', responded_at=now(), rejected_reason=_reason, updated_at=now()
      WHERE id=_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (g.borrower_id, '❌ Penjamin menolak',
      COALESCE(v_guarantor_nama,'Anggota') || ' menolak menjadi penjamin. Alasan: ' || COALESCE(_reason,'-'),
      'peringatan', '/pinjaman', 'loan_guarantors', g.id);
  ELSE
    RAISE EXCEPTION 'Aksi tidak valid';
  END IF;
END $$;

-- ===== Buku Besar Anggota =====
CREATE OR REPLACE FUNCTION public.get_member_ledger(_user_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(
  tanggal timestamptz,
  jenis text,
  keterangan text,
  arah text,
  debit numeric,
  kredit numeric,
  ref_table text,
  ref_id uuid,
  status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id <> auth.uid() AND NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT s.created_at AS tanggal, 'Simpanan'::text AS jenis,
      ('Setoran ' || s.jenis::text)::text AS keterangan,
      'in'::text AS arah, 0::numeric AS debit, s.nominal AS kredit,
      'simpanan'::text AS ref_table, s.id AS ref_id, s.status::text AS status
    FROM public.simpanan s WHERE s.user_id = _user_id AND s.deleted_at IS NULL
    UNION ALL
    SELECT COALESCE(p.disbursed_at, p.created_at), 'Pencairan Pinjaman',
      'Pinjaman cair (tujuan: ' || COALESCE(p.tujuan,'-') || ')',
      'in', p.nominal, 0, 'pinjaman', p.id, p.status::text
    FROM public.pinjaman p
    WHERE p.user_id = _user_id AND p.deleted_at IS NULL AND p.status = 'disbursed'
    UNION ALL
    SELECT COALESCE(a.paid_at, a.created_at), 'Angsuran',
      'Cicilan ke-' || a.cicilan_ke,
      'out', a.nominal, 0, 'angsuran', a.id, a.status::text
    FROM public.angsuran a WHERE a.user_id = _user_id AND a.deleted_at IS NULL AND a.status = 'paid'
    UNION ALL
    SELECT COALESCE(a.paid_at, a.denda_updated_at, a.created_at), 'Denda',
      'Denda cicilan ke-' || a.cicilan_ke,
      'out', a.denda, 0, 'angsuran', a.id, a.status::text
    FROM public.angsuran a WHERE a.user_id = _user_id AND a.deleted_at IS NULL AND a.denda > 0 AND a.status = 'paid'
    UNION ALL
    SELECT COALESCE(sh.dibagikan_at, sh.created_at), 'SHU',
      'Pembagian SHU tahun ' || sh.tahun,
      'in', 0, sh.nominal, 'shu', sh.id, NULL
    FROM public.shu sh WHERE sh.user_id = _user_id AND sh.deleted_at IS NULL AND sh.dibagikan_at IS NOT NULL
  )
  SELECT * FROM rows
  WHERE (_from IS NULL OR rows.tanggal::date >= _from)
    AND (_to IS NULL OR rows.tanggal::date <= _to)
  ORDER BY rows.tanggal DESC;
END $$;
