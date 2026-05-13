
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('ktp', 'ktp', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- KTP policies (private — owner & pengurus only)
DROP POLICY IF EXISTS "ktp owner read" ON storage.objects;
CREATE POLICY "ktp owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ktp' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_pengurus(auth.uid())));

DROP POLICY IF EXISTS "ktp owner upload" ON storage.objects;
CREATE POLICY "ktp owner upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ktp' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "ktp owner update" ON storage.objects;
CREATE POLICY "ktp owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ktp' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars policies (public read, owner write)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars owner upload" ON storage.objects;
CREATE POLICY "avatars owner upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update handle_new_user to capture extra fields
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
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
  v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nik, alamat, ktp_url, foto_url, nomor_anggota)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'no_hp',
    NEW.raw_user_meta_data->>'nik',
    NEW.raw_user_meta_data->>'alamat',
    NEW.raw_user_meta_data->>'ktp_url',
    NEW.raw_user_meta_data->>'foto_url',
    v_nomor
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'anggota');
  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure trigger on auth.users exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
