CREATE OR REPLACE FUNCTION public.approve_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nominal_pokok numeric := 0;
  v_setting jsonb;
BEGIN
  -- Hanya pengurus yang boleh memverifikasi
  IF NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya pengurus yang dapat memverifikasi anggota';
  END IF;

  -- Pastikan anggota ada
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Anggota tidak ditemukan';
  END IF;

  -- Set status aktif
  UPDATE public.profiles
    SET status = 'active', updated_at = now(), updated_by = auth.uid()
    WHERE id = p_user_id;

  -- Buat dompet (idempoten)
  PERFORM public.get_or_create_wallet(p_user_id);

  -- Ambil nominal simpanan pokok dari settings (kalau ada)
  SELECT value INTO v_setting FROM public.settings WHERE key = 'simpanan_pokok_nominal' LIMIT 1;
  IF v_setting IS NOT NULL THEN
    BEGIN
      v_nominal_pokok := (v_setting #>> '{}')::numeric;
    EXCEPTION WHEN OTHERS THEN v_nominal_pokok := 0;
    END;
  END IF;

  -- Buat tagihan simpanan pokok pending bila belum ada dan nominal > 0
  IF v_nominal_pokok > 0 AND NOT EXISTS (
    SELECT 1 FROM public.simpanan WHERE user_id = p_user_id AND jenis = 'pokok' AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.simpanan (user_id, jenis, nominal, status, catatan, created_by)
    VALUES (p_user_id, 'pokok', v_nominal_pokok, 'pending', 'Tagihan otomatis saat aktivasi anggota', auth.uid());
  END IF;

  -- Audit log
  BEGIN
    INSERT INTO public.audit_logs (actor_id, entity, entity_id, action, new_data)
    VALUES (auth.uid(), 'profiles', p_user_id, 'member_active', jsonb_build_object('status','active'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Notifikasi ke anggota
  BEGIN
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, ref_table, ref_id, url)
    VALUES (
      p_user_id,
      '🎉 Akun Anda telah diaktifkan',
      'Selamat! Pendaftaran Anda disetujui pengurus. Silakan lengkapi simpanan pokok dan mulai menggunakan layanan koperasi.',
      'sukses'::notif_kategori,
      'profiles',
      p_user_id,
      '/dashboard'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_member(uuid) TO service_role;