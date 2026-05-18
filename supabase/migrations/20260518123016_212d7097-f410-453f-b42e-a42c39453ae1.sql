
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.bank_mutations (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL,
  keterangan text NOT NULL,
  nominal numeric NOT NULL,
  jenis text NOT NULL CHECK (jenis IN ('kredit','debit')),
  saldo numeric,
  bank_name text,
  source_file text,
  raw_row jsonb,
  matched_table text,
  matched_id uuid,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','ignored')),
  matched_by uuid,
  matched_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_mut_status ON public.bank_mutations(status);
CREATE INDEX IF NOT EXISTS idx_bank_mut_tanggal ON public.bank_mutations(tanggal);
CREATE INDEX IF NOT EXISTS idx_bank_mut_matched ON public.bank_mutations(matched_table, matched_id);
ALTER TABLE public.bank_mutations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_mut pengurus all" ON public.bank_mutations FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));
CREATE TRIGGER trg_bank_mut_updated BEFORE UPDATE ON public.bank_mutations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.loan_agreements (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  pinjaman_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  pdf_path text,
  content_hash text,
  terms_version text NOT NULL DEFAULT 'v1',
  member_signature_id uuid,
  member_signed_at timestamptz,
  pengurus_signature_id uuid,
  pengurus_signed_at timestamptz,
  pengurus_id uuid,
  status text NOT NULL DEFAULT 'pending_member' CHECK (status IN ('pending_member','pending_pengurus','signed','cancelled')),
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_akad_user ON public.loan_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_akad_status ON public.loan_agreements(status);
ALTER TABLE public.loan_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "akad view own or pengurus" ON public.loan_agreements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "akad insert own or pengurus" ON public.loan_agreements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "akad update own pending or pengurus" ON public.loan_agreements FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id AND status = 'pending_member') OR public.is_pengurus(auth.uid()));
CREATE TRIGGER trg_akad_updated BEFORE UPDATE ON public.loan_agreements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('akad-pinjaman', 'akad-pinjaman', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "akad upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'akad-pinjaman' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));
CREATE POLICY "akad read own folder or pengurus" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'akad-pinjaman' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));
CREATE POLICY "akad update own folder or pengurus" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'akad-pinjaman' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));
