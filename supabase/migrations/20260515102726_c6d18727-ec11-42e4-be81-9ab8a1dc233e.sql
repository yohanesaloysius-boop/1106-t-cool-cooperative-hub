-- 1) Wire handle_new_user trigger on auth.users (was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill profiles + user_roles for any existing auth.users without profile
DO $$
DECLARE
  r record;
  v_year text := to_char(now(), 'YYYY');
  v_count int;
  v_nomor text;
  v_status member_status;
  v_nama text;
  v_seed_marker uuid := '00000000-0000-0000-0000-000000000001';
  i int := 0;
  pekerjaan_array text[] := ARRAY['Karyawan Swasta','Wiraswasta','Guru','Petani','PNS','Pedagang','Sopir','Buruh','Mahasiswa','Ibu Rumah Tangga'];
BEGIN
  FOR r IN SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
           FROM auth.users u
           LEFT JOIN public.profiles p ON p.id = u.id
           WHERE p.id IS NULL
           ORDER BY u.created_at
  LOOP
    i := i + 1;
    SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
    v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::text, 4, '0');
    v_nama := COALESCE(r.raw_user_meta_data->>'nama_lengkap', r.email);

    -- Demo accounts: spread statuses similar to original seed
    IF r.email LIKE '%@demo.tcool.id' THEN
      IF i <= 20 THEN v_status := 'active';
      ELSIF i <= 27 THEN v_status := 'pending';
      ELSE v_status := 'suspended';
      END IF;
    ELSE
      v_status := 'pending';
    END IF;

    INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, nomor_anggota, status, joined_at, created_by, pekerjaan, jenis_kelamin)
    VALUES (
      r.id, v_nama, r.email,
      r.raw_user_meta_data->>'no_hp',
      r.raw_user_meta_data->>'nik',
      r.raw_user_meta_data->>'alamat',
      v_nomor, v_status, r.created_at,
      CASE WHEN r.email LIKE '%@demo.tcool.id' THEN v_seed_marker ELSE NULL END,
      pekerjaan_array[1 + (i % 10)],
      CASE WHEN i % 2 = 0 THEN 'L' ELSE 'P' END
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (r.id, 'anggota')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;