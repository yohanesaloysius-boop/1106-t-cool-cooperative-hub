
-- 1) Aktifkan realtime untuk profiles & notifications agar Kelola Anggota & Dashboard SA langsung update
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- 2) Update handle_new_user: tambahkan notifikasi ke semua pengurus saat anggota baru daftar (status pending)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_count INT;
  v_nomor TEXT;
  v_role app_role;
  v_status member_status;
  v_nama TEXT;
  v_phone TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
  v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  v_phone := COALESCE(NEW.raw_user_meta_data->>'no_hp', NEW.phone);

  IF public.is_sa_identity(NEW.email, v_phone) THEN
    v_role := 'super_admin';
    v_status := 'active';
  ELSE
    v_role := 'anggota';
    v_status := 'pending';
  END IF;

  v_nama := COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email);

  INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, ktp_url, foto_url, nomor_anggota, status)
  VALUES (
    NEW.id, v_nama, NEW.email, v_phone,
    NEW.raw_user_meta_data->>'nik',
    NEW.raw_user_meta_data->>'alamat',
    NEW.raw_user_meta_data->>'ktp_url',
    NEW.raw_user_meta_data->>'foto_url',
    v_nomor, v_status
  )
  ON CONFLICT (id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    email = EXCLUDED.email,
    no_hp = EXCLUDED.no_hp,
    nik = EXCLUDED.nik,
    alamat = EXCLUDED.alamat,
    ktp_url = EXCLUDED.ktp_url,
    foto_url = EXCLUDED.foto_url,
    status = EXCLUDED.status,
    deleted_at = NULL,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role, deleted_at)
  VALUES (NEW.id, v_role, NULL)
  ON CONFLICT (user_id, role) DO UPDATE SET deleted_at = NULL;

  -- Notif sambutan ke anggota
  BEGIN
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.id,
      '🎉 Selamat Datang di T-COOL, ' || split_part(v_nama, ' ', 1) || '!',
      'Halo ' || v_nama || ', terima kasih telah bergabung sebagai anggota Koperasi T-COOL. Nomor anggota Anda: ' || v_nomor || '. ' ||
      CASE WHEN v_status = 'pending'
        THEN 'Akun Anda sedang menunggu verifikasi pengurus.'
        ELSE 'Akun Anda sudah aktif.'
      END,
      'sukses', '/profil', 'profiles', NEW.id
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Notif ke seluruh pengurus saat ada pendaftar baru yang masih pending (butuh approval)
  IF v_status = 'pending' THEN
    BEGIN
      INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
      SELECT
        ur.user_id,
        '🆕 Pendaftar baru menunggu verifikasi',
        'Anggota baru "' || v_nama || '" (' || v_nomor || ') telah mendaftar. Mohon segera diverifikasi di halaman Kelola Anggota.',
        'approval'::notif_kategori,
        '/admin/anggota',
        'profiles',
        NEW.id
      FROM public.user_roles ur
      WHERE ur.role IN ('super_admin','ketua','sekretaris','bendahara')
        AND ur.deleted_at IS NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
