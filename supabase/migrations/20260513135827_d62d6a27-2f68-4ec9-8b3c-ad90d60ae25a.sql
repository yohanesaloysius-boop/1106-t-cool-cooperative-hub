-- Create private buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('dokumen-pinjaman','dokumen-pinjaman', false),
  ('bukti-transfer','bukti-transfer', false),
  ('tanda-tangan','tanda-tangan', false),
  ('laporan-pdf','laporan-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: policy creator for each bucket
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['dokumen-pinjaman','bukti-transfer','tanda-tangan','laporan-pdf'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s view own or pengurus"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = %2$L AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));
    $f$, b, b);

    EXECUTE format($f$
      CREATE POLICY "%1$s upload own or pengurus"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %2$L AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));
    $f$, b, b);

    EXECUTE format($f$
      CREATE POLICY "%1$s update own or pengurus"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = %2$L AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));
    $f$, b, b);

    EXECUTE format($f$
      CREATE POLICY "%1$s delete pengurus"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = %2$L AND public.is_pengurus(auth.uid()));
    $f$, b, b);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;