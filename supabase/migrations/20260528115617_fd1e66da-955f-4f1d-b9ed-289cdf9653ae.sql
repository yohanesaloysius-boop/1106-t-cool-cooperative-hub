-- Helper: normalize phone to digits-only last 10
CREATE OR REPLACE FUNCTION public.is_sa_identity(_email text, _phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    lower(coalesce(_email,'')) = 'yohanesaloysius@gmail.com'
    OR regexp_replace(coalesce(_phone,''), '\D', '', 'g') IN ('081372776788','6281372776788','81372776788');
$$;

-- Update handle_new_user to also match by phone
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

  RETURN NEW;
END;
$function$;

-- RPC: ensure current logged-in user is super_admin if identity matches
CREATE OR REPLACE FUNCTION public.ensure_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_phone text;
  v_profile_phone text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT email, phone INTO v_email, v_phone FROM auth.users WHERE id = v_uid;
  SELECT no_hp INTO v_profile_phone FROM public.profiles WHERE id = v_uid;

  IF public.is_sa_identity(v_email, COALESCE(v_phone, v_profile_phone)) THEN
    UPDATE public.profiles SET status = 'active', deleted_at = NULL, updated_at = now() WHERE id = v_uid;
    INSERT INTO public.user_roles (user_id, role, deleted_at)
    VALUES (v_uid, 'super_admin', NULL)
    ON CONFLICT (user_id, role) DO UPDATE SET deleted_at = NULL;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sa_identity(text, text) TO authenticated, anon;