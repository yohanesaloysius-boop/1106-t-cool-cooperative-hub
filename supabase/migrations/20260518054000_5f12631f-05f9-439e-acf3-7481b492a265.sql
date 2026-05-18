
-- Bucket privat untuk dokumen verifikasi
INSERT INTO storage.buckets (id, name, public) VALUES ('verifikasi-pinjaman', 'verifikasi-pinjaman', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage: pemilik upload/lihat di folder {user_id}/..., pengurus lihat semua
CREATE POLICY "verif-pinjaman owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verifikasi-pinjaman' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "verif-pinjaman owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verifikasi-pinjaman' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));

CREATE POLICY "verif-pinjaman owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'verifikasi-pinjaman' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.verif_status AS ENUM ('pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabel verifikasi
CREATE TABLE public.loan_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pinjaman_id uuid,
  ktp_image_path text,
  selfie_image_path text,
  status public.verif_status NOT NULL DEFAULT 'pending',
  ocr_data jsonb,
  face_match_score numeric,
  location jsonb,
  ip_address text,
  user_agent text,
  admin_notes text,
  verified_by uuid,
  verified_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loan_verif_user ON public.loan_verifications(user_id);
CREATE INDEX idx_loan_verif_status ON public.loan_verifications(status);

ALTER TABLE public.loan_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lv insert own" ON public.loan_verifications
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lv update own pending" ON public.loan_verifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "lv view own or pengurus" ON public.loan_verifications
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));

CREATE POLICY "lv pengurus update" ON public.loan_verifications
FOR UPDATE TO authenticated USING (public.is_pengurus(auth.uid()));

CREATE TRIGGER trg_lv_updated BEFORE UPDATE ON public.loan_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Logs
CREATE TABLE public.verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES public.loan_verifications(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  catatan text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_verif_logs_verif ON public.verification_logs(verification_id);

ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vl insert auth" ON public.verification_logs
FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR public.is_pengurus(auth.uid()));

CREATE POLICY "vl view related" ON public.verification_logs
FOR SELECT TO authenticated USING (
  public.is_pengurus(auth.uid())
  OR EXISTS (SELECT 1 FROM public.loan_verifications lv WHERE lv.id = verification_logs.verification_id AND lv.user_id = auth.uid())
);

-- Link kolom di pinjaman
ALTER TABLE public.pinjaman ADD COLUMN IF NOT EXISTS verification_id uuid REFERENCES public.loan_verifications(id);

-- RPC: pengurus approve/reject verifikasi
CREATE OR REPLACE FUNCTION public.mp_review_loan_verification(_id uuid, _action text, _catatan text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.loan_verifications%ROWTYPE;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO v FROM public.loan_verifications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verifikasi tidak ditemukan'; END IF;
  IF _action = 'approve' THEN
    UPDATE public.loan_verifications
      SET status='verified', verified_by=auth.uid(), verified_at=now(), admin_notes=COALESCE(_catatan, admin_notes), updated_at=now()
      WHERE id=_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url)
    VALUES (v.user_id, '✅ Verifikasi identitas disetujui',
      'Identitas Anda terverifikasi. Pengajuan pinjaman akan diproses pengurus.',
      'sukses', '/pinjaman');
  ELSIF _action = 'reject' THEN
    UPDATE public.loan_verifications
      SET status='rejected', verified_by=auth.uid(), verified_at=now(),
          admin_notes=COALESCE(_catatan, admin_notes), rejected_reason=_catatan, updated_at=now()
      WHERE id=_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url)
    VALUES (v.user_id, '❌ Verifikasi identitas ditolak',
      'Verifikasi ditolak. Alasan: ' || COALESCE(_catatan,'-') || '. Silakan ajukan ulang dengan foto yang lebih jelas.',
      'peringatan', '/pinjaman');
  ELSE RAISE EXCEPTION 'Aksi tidak valid'; END IF;

  INSERT INTO public.verification_logs (verification_id, actor_id, action, catatan)
  VALUES (_id, auth.uid(), _action, _catatan);
END $$;
