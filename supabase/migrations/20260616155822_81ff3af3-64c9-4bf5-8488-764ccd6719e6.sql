-- Seed "Tentang Kami" content keys into settings (jsonb text values)
INSERT INTO public.settings (key, value)
VALUES
  ('tentang.makna_logo', to_jsonb('Logo koperasi melambangkan pertumbuhan, kebersamaan, dan kesejahteraan anggota. Nama "T-COOL Koperasi" mencerminkan koperasi yang modern, transparan, dan terpercaya.'::text)),
  ('tentang.visi', to_jsonb('Menjadi koperasi digital yang sehat, mandiri, dan terpercaya untuk meningkatkan kesejahteraan seluruh anggota.'::text)),
  ('tentang.misi', to_jsonb(E'Memberikan pelayanan simpan pinjam yang cepat, mudah, dan transparan.\nMeningkatkan kesejahteraan ekonomi anggota melalui usaha bersama.\nMengelola koperasi secara profesional dan akuntabel.'::text)),
  ('tentang.sejarah', to_jsonb('Koperasi didirikan atas dasar semangat gotong royong anggota untuk membangun ekonomi bersama. Sejak berdiri, koperasi terus berkembang melayani kebutuhan simpan pinjam dan usaha anggota.'::text)),
  ('tentang.struktur_manajemen', to_jsonb(E'Manajer\nStaf Administrasi\nStaf Keuangan\nStaf Pelayanan Anggota'::text)),
  ('tentang.tata_kebijakan', to_jsonb(E'Kebijakan simpanan dan pinjaman mengacu pada AD/ART koperasi.\nSeluruh transaksi tercatat dan dapat diaudit.\nPembagian SHU dilakukan secara adil dan transparan.'::text)),
  ('tentang.org_rapat_anggota', to_jsonb('RAPAT ANGGOTA'::text)),
  ('tentang.org_pengawas', to_jsonb(E'Ketua\nAnggota\nAnggota'::text)),
  ('tentang.org_pengurus', to_jsonb(E'Ketua\nWakil Ketua\nSekretaris\nBendahara I\nBendahara II'::text)),
  ('tentang.org_manajemen', to_jsonb('MANAJEMEN'::text)),
  ('tentang.org_anggota', to_jsonb('ANGGOTA'::text)),
  ('tentang.org_eksternal', to_jsonb(E'DINAS KOPERASI UKM PROV. BALI\nPUSKOPDIT BALI ARTHA GUNA\nDEWAN PENASEHAT'::text))
ON CONFLICT (key) DO NOTHING;

-- Public read RPC for tentang content
CREATE OR REPLACE FUNCTION public.get_public_tentang()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(replace(key, 'tentang.', ''), value), '{}'::jsonb)
  FROM public.settings
  WHERE key LIKE 'tentang.%';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tentang() TO anon, authenticated;