
DO $$
DECLARE
  v_admin_id uuid;
  v_user_id uuid;
  v_email text;
  v_nama text;
  v_nomor text;
  i int;
  names text[] := ARRAY[
    'Budi Santoso','Siti Aminah','Agus Wijaya','Dewi Lestari','Rudi Hartono',
    'Rina Marlina','Andi Pratama','Yuni Astuti','Bambang Sutrisno','Fitri Handayani',
    'Hendra Kusuma','Lina Suryani','Joko Susilo','Maya Permata','Dedi Mulyadi',
    'Wati Ningsih','Eko Prabowo','Tuti Rahmawati','Slamet Riyadi','Endang Sukarni',
    'Adi Nugroho','Sri Wahyuni','Heri Setiawan','Nia Kurnia','Doni Pranata',
    'Lia Anggraini','Iwan Setiadi','Ratna Sari','Yudi Hermawan','Mega Puspita'
  ];
BEGIN
  v_admin_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'yohanesaloysius@gmail.com', crypt('Admin123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nama_lengkap":"Yohanes Aloysius"}'::jsonb,
    false, '', '', '', ''
  );
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_admin_id,
    jsonb_build_object('sub', v_admin_id::text, 'email', 'yohanesaloysius@gmail.com', 'email_verified', true),
    'email', v_admin_id::text, now(), now(), now());

  INSERT INTO public.profiles (id, nomor_anggota, nama_lengkap, email, status, joined_at)
  VALUES (v_admin_id, 'SA-0001', 'Yohanes Aloysius', 'yohanesaloysius@gmail.com', 'active', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  FOR i IN 1..30 LOOP
    v_user_id := gen_random_uuid();
    v_nama := names[i];
    v_email := 'anggota' || lpad(i::text, 2, '0') || '@yeskoperasi.com';
    v_nomor := 'AGT-' || lpad(i::text, 4, '0');

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_email, crypt('anggota123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nama_lengkap', v_nama),
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());

    INSERT INTO public.profiles (id, nomor_anggota, nama_lengkap, email, no_hp, alamat, jenis_kelamin, pekerjaan, status, joined_at)
    VALUES (
      v_user_id, v_nomor, v_nama, v_email,
      '08' || lpad((1000000000 + i * 12345)::text, 10, '0'),
      'Jl. Merdeka No. ' || i || ', Jakarta',
      CASE WHEN i % 2 = 0 THEN 'perempuan' ELSE 'laki-laki' END,
      'Wiraswasta',
      'active',
      now() - (i || ' days')::interval
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'anggota')
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;
