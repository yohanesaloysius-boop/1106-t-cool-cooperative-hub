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
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
  v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  IF lower(NEW.email) = 'yohanesaloysius@gmail.com' THEN
    v_role := 'super_admin';
    v_status := 'active';
  ELSE
    v_role := 'anggota';
    v_status := 'pending';
  END IF;

  v_nama := COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email);

  INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, ktp_url, foto_url, nomor_anggota, status)
  VALUES (
    NEW.id, v_nama, NEW.email,
    NEW.raw_user_meta_data->>'no_hp',
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
      'sukses',
      '/profil',
      'profiles',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;