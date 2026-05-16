
-- Hapus dummy profile super admin, lalu buat akun auth asli
DELETE FROM public.user_roles WHERE user_id='aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM public.notifications WHERE user_id='aaaaaaaa-0000-0000-0000-000000000001';
DELETE FROM public.profiles WHERE id='aaaaaaaa-0000-0000-0000-000000000001';

-- Create auth user with password 'Yes555888!' (trigger handle_new_user akan auto-create profile + role super_admin)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated','authenticated',
  'yohanesaloysius@gmail.com',
  crypt('Yes555888!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nama_lengkap":"Yohanes Aloysius"}'::jsonb,
  now(), now(), '', '', '', ''
);
