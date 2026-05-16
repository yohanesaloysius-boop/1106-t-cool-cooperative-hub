DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'yohanesaloysius@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'yohanesaloysius@gmail.com', crypt('Yes555888!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nama_lengkap":"Yohanes Aloysius"}'::jsonb,
      '', '', '', ''
    );
  END IF;

  INSERT INTO public.profiles (id, nama_lengkap, email, status)
  VALUES (v_uid, 'Yohanes Aloysius', 'yohanesaloysius@gmail.com', 'active')
  ON CONFLICT (id) DO UPDATE SET status='active', email=EXCLUDED.email, nama_lengkap=EXCLUDED.nama_lengkap;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;