DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: buat profile untuk user auth yang belum punya baris di profiles
INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, ktp_url, foto_url, nomor_anggota, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'nama_lengkap', u.email),
  u.email,
  u.raw_user_meta_data->>'no_hp',
  u.raw_user_meta_data->>'nik',
  u.raw_user_meta_data->>'alamat',
  u.raw_user_meta_data->>'ktp_url',
  u.raw_user_meta_data->>'foto_url',
  'TCOOL-' || to_char(now(),'YYYY') || '-' || LPAD((
    (SELECT COUNT(*) FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || to_char(now(),'YYYY') || '-%') + row_number() OVER (ORDER BY u.created_at)
  )::text, 4, '0'),
  'pending'::member_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Pastikan role 'anggota' juga ada untuk user yang baru di-backfill
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'anggota'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles r ON r.user_id = p.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;