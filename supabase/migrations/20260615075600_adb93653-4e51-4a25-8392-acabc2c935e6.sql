-- Recreate the missing trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill users who signed up but have no profile yet
DO $$
DECLARE
  r RECORD;
  v_year TEXT := to_char(now(), 'YYYY');
  v_count INT;
  v_nomor TEXT;
  v_role app_role;
  v_status member_status;
  v_nama TEXT;
  v_phone TEXT;
BEGIN
  FOR r IN
    SELECT u.* FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ORDER BY u.created_at
  LOOP
    SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
    v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    v_phone := COALESCE(r.raw_user_meta_data->>'no_hp', r.phone);

    IF public.is_sa_identity(r.email, v_phone) THEN
      v_role := 'super_admin'; v_status := 'active';
    ELSE
      v_role := 'anggota'; v_status := 'pending';
    END IF;

    v_nama := COALESCE(r.raw_user_meta_data->>'nama_lengkap', r.email);

    INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, ktp_url, foto_url, nomor_anggota, status)
    VALUES (r.id, v_nama, r.email, v_phone,
      r.raw_user_meta_data->>'nik', r.raw_user_meta_data->>'alamat',
      r.raw_user_meta_data->>'ktp_url', r.raw_user_meta_data->>'foto_url',
      v_nomor, v_status)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, deleted_at)
    VALUES (r.id, v_role, NULL)
    ON CONFLICT (user_id, role) DO UPDATE SET deleted_at = NULL;

    BEGIN
      INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
      VALUES (r.id,
        '🎉 Selamat Datang di T-COOL, ' || split_part(v_nama, ' ', 1) || '!',
        'Halo ' || v_nama || ', terima kasih telah bergabung sebagai anggota Koperasi T-COOL. Nomor anggota Anda: ' || v_nomor || '. ' ||
        CASE WHEN v_status = 'pending' THEN 'Akun Anda sedang menunggu verifikasi pengurus.' ELSE 'Akun Anda sudah aktif.' END,
        'sukses', '/profil', 'profiles', r.id)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    IF v_status = 'pending' THEN
      BEGIN
        INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
        SELECT ur.user_id, '🆕 Pendaftar baru menunggu verifikasi',
          'Anggota baru "' || v_nama || '" (' || v_nomor || ') telah mendaftar. Mohon segera diverifikasi di halaman Kelola Anggota.',
          'approval'::notif_kategori, '/admin/anggota', 'profiles', r.id
        FROM public.user_roles ur
        WHERE ur.role IN ('super_admin','ketua','sekretaris','bendahara') AND ur.deleted_at IS NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;