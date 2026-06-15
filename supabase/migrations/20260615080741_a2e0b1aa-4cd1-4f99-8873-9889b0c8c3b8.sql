-- ============================================================
-- Defense-in-depth untuk alur pendaftaran anggota
-- ============================================================

-- 1) Fungsi inti bersama: provision profil + role + notifikasi untuk satu user.
--    Dipakai oleh trigger handle_new_user DAN self-healing ensure_my_profile.
CREATE OR REPLACE FUNCTION public.provision_member(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_count INT;
  v_nomor TEXT;
  v_role app_role;
  v_status member_status;
  v_nama TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_meta jsonb;
BEGIN
  -- Sudah punya profil? jangan duplikasi (idempotent)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid) THEN
    RETURN;
  END IF;

  SELECT email, phone, raw_user_meta_data
    INTO v_email, v_phone, v_meta
  FROM auth.users WHERE id = _uid;

  IF v_email IS NULL AND v_meta IS NULL THEN
    RETURN; -- user auth belum ada / tidak valid
  END IF;

  v_phone := COALESCE(v_meta->>'no_hp', v_phone);

  SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
  v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  IF public.is_sa_identity(v_email, v_phone) THEN
    v_role := 'super_admin';
    v_status := 'active';
  ELSE
    v_role := 'anggota';
    v_status := 'pending';
  END IF;

  v_nama := COALESCE(v_meta->>'nama_lengkap', v_email);

  INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, ktp_url, foto_url, nomor_anggota, status)
  VALUES (
    _uid, v_nama, v_email, v_phone,
    v_meta->>'nik', v_meta->>'alamat', v_meta->>'ktp_url', v_meta->>'foto_url',
    v_nomor, v_status
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, deleted_at)
  VALUES (_uid, v_role, NULL)
  ON CONFLICT (user_id, role) DO UPDATE SET deleted_at = NULL;

  -- Notif sambutan ke anggota
  BEGIN
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      _uid,
      '🎉 Selamat Datang di T-COOL, ' || split_part(v_nama, ' ', 1) || '!',
      'Halo ' || v_nama || ', terima kasih telah bergabung sebagai anggota Koperasi T-COOL. Nomor anggota Anda: ' || v_nomor || '. ' ||
      CASE WHEN v_status = 'pending'
        THEN 'Akun Anda sedang menunggu verifikasi pengurus.'
        ELSE 'Akun Anda sudah aktif.'
      END,
      'sukses', '/profil', 'profiles', _uid
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Notif ke seluruh pengurus saat pendaftar baru pending (butuh approval)
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
        _uid
      FROM public.user_roles ur
      WHERE ur.role IN ('super_admin','ketua','sekretaris','bendahara')
        AND ur.deleted_at IS NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;

-- 2) Trigger pendaftaran kini cukup memanggil fungsi inti
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_member(NEW.id);
  RETURN NEW;
END;
$$;

-- Pasang ulang trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Self-healing: dipanggil saat login. Jika profil user yang sedang login
--    belum ada (mis. trigger sempat terlepas), buat sekarang.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RETURN false; -- sudah ada, tidak perlu apa-apa
  END IF;
  PERFORM public.provision_member(v_uid);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- 4) Health-check: deteksi bila trigger penting hilang (untuk monitoring)
CREATE OR REPLACE FUNCTION public.check_critical_triggers()
RETURNS TABLE(trigger_name text, table_name text, present boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'on_auth_user_created'::text, 'auth.users'::text,
    EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'on_auth_user_created'
        AND n.nspname = 'auth' AND c.relname = 'users'
        AND NOT t.tgisinternal
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_critical_triggers() TO authenticated;
