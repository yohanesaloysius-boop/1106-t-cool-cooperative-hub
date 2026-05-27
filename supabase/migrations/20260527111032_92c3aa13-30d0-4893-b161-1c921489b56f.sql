
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('ktp', 'ktp', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('marketplace', 'marketplace', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('verifikasi-pinjaman', 'verifikasi-pinjaman', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('akad-pinjaman', 'akad-pinjaman', false, 20971520, ARRAY['application/pdf','image/jpeg','image/png']),
  ('bukti-transfer', 'bukti-transfer', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('dokumen-pinjaman', 'dokumen-pinjaman', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('tanda-tangan', 'tanda-tangan', false, 1048576, ARRAY['image/png']),
  ('laporan-pdf', 'laporan-pdf', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE
  pol_name TEXT;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname LIKE 'app_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol_name);
  END LOOP;
END$$;

CREATE POLICY "app_public_read_public_buckets"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars','marketplace'));

CREATE POLICY "app_owner_insert_public_buckets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars','marketplace')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_owner_update_public_buckets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars','marketplace')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_owner_delete_public_buckets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('avatars','marketplace')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_owner_select_private_buckets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('ktp','verifikasi-pinjaman','akad-pinjaman','bukti-transfer','dokumen-pinjaman','tanda-tangan','laporan-pdf','signatures')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_owner_insert_private_buckets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('ktp','verifikasi-pinjaman','akad-pinjaman','bukti-transfer','dokumen-pinjaman','tanda-tangan','laporan-pdf','signatures')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_owner_update_private_buckets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('ktp','verifikasi-pinjaman','akad-pinjaman','bukti-transfer','dokumen-pinjaman','tanda-tangan','laporan-pdf','signatures')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_owner_delete_private_buckets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('ktp','verifikasi-pinjaman','akad-pinjaman','bukti-transfer','dokumen-pinjaman','tanda-tangan','laporan-pdf','signatures')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "app_admin_all_buckets"
  ON storage.objects FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'ketua'::public.app_role)
    OR public.has_role(auth.uid(), 'sekretaris'::public.app_role)
    OR public.has_role(auth.uid(), 'bendahara'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'ketua'::public.app_role)
    OR public.has_role(auth.uid(), 'sekretaris'::public.app_role)
    OR public.has_role(auth.uid(), 'bendahara'::public.app_role)
  );
