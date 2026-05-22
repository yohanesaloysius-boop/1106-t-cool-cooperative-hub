
-- 1. Profile AD/ART signature columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adart_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS adart_signature_url text,
  ADD COLUMN IF NOT EXISTS adart_signature_hash text,
  ADD COLUMN IF NOT EXISTS adart_version text;

-- 2. Official letters table
CREATE TABLE IF NOT EXISTS public.official_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  letter_type text NOT NULL CHECK (letter_type IN ('keterangan_anggota','rekomendasi_pinjaman','keterangan_usaha','lainnya')),
  nomor_surat text NOT NULL,
  perihal text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_url text,
  generated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_official_letters_member ON public.official_letters(member_id);
CREATE INDEX IF NOT EXISTS idx_official_letters_type ON public.official_letters(letter_type);
ALTER TABLE public.official_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "letters_member_read" ON public.official_letters
  FOR SELECT TO authenticated USING (member_id = auth.uid() OR is_pengurus(auth.uid()));
CREATE POLICY "letters_pengurus_write" ON public.official_letters
  FOR INSERT TO authenticated WITH CHECK (is_pengurus(auth.uid()));
CREATE POLICY "letters_pengurus_update" ON public.official_letters
  FOR UPDATE TO authenticated USING (is_pengurus(auth.uid()));
CREATE POLICY "letters_pengurus_delete" ON public.official_letters
  FOR DELETE TO authenticated USING (is_pengurus(auth.uid()));

-- 3. Signatures bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sig_user_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_pengurus(auth.uid())));
CREATE POLICY "sig_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Default settings (only insert if absent)
INSERT INTO public.settings (key, value, description, is_public)
VALUES
  ('adart_content', jsonb_build_object(
    'version', '1.0',
    'updated_at', now(),
    'pasal', jsonb_build_array(
      jsonb_build_object('bab','BAB I - KETENTUAN UMUM','isi','Koperasi ini bernama T-COOL Koperasi, didirikan untuk meningkatkan kesejahteraan anggota berdasarkan asas kekeluargaan.'),
      jsonb_build_object('bab','BAB II - KEANGGOTAAN','isi','Anggota wajib membayar simpanan pokok, wajib, dan mematuhi seluruh ketentuan AD/ART serta keputusan rapat anggota.'),
      jsonb_build_object('bab','BAB III - HAK & KEWAJIBAN','isi','Anggota berhak mendapat pelayanan koperasi, SHU, dan suara dalam RAT. Kewajiban: aktif, jujur, dan menjaga nama baik koperasi.'),
      jsonb_build_object('bab','BAB IV - PENGURUS & PENGAWAS','isi','Pengurus dan pengawas dipilih dalam RAT untuk masa jabatan 3 tahun.'),
      jsonb_build_object('bab','BAB V - PERMODALAN & SHU','isi','Modal koperasi berasal dari simpanan anggota, hibah, dan SHU. Pembagian SHU sesuai keputusan RAT.'),
      jsonb_build_object('bab','BAB VI - PEMBUBARAN','isi','Pembubaran koperasi hanya dapat dilakukan melalui keputusan RAT khusus dengan kuorum 2/3 anggota.')
    )
  ), 'Isi AD/ART yang ditampilkan dan ditandatangani anggota saat daftar', true),
  ('koperasi_info', jsonb_build_object(
    'nama','T-COOL Koperasi',
    'alamat','Jl. Contoh No. 1, Jakarta',
    'nomor_badan_hukum','-',
    'telepon','-',
    'email','-',
    'ketua','-',
    'sekretaris','-'
  ), 'Informasi kop koperasi untuk surat resmi & AD/ART', true)
ON CONFLICT (key) DO NOTHING;
