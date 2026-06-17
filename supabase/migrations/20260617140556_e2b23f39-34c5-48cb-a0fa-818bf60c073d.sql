-- 1. marketplace_stores: hapus akses anon pada SELECT
DROP POLICY IF EXISTS "stores public read active" ON public.marketplace_stores;
CREATE POLICY "stores read active members" ON public.marketplace_stores
  FOR SELECT TO authenticated
  USING (
    (status_toko = 'active'::store_status)
    OR (auth.uid() = member_id)
    OR is_pengurus(auth.uid())
  );

-- 2a. profiles: tambah WITH CHECK pada policy pengurus
DROP POLICY IF EXISTS "pengurus update any profile" ON public.profiles;
CREATE POLICY "pengurus update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_pengurus(auth.uid()))
  WITH CHECK (is_pengurus(auth.uid()));

-- 2b. trigger: cegah perubahan NIK & KTP milik anggota lain oleh pengurus
CREATE OR REPLACE FUNCTION public.protect_sensitive_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Jika yang mengubah BUKAN pemilik profil, larang ubah NIK/KTP
  IF auth.uid() IS DISTINCT FROM NEW.id THEN
    IF NEW.nik IS DISTINCT FROM OLD.nik THEN
      RAISE EXCEPTION 'Tidak diizinkan mengubah NIK anggota lain';
    END IF;
    IF NEW.ktp_url IS DISTINCT FROM OLD.ktp_url THEN
      RAISE EXCEPTION 'Tidak diizinkan mengubah foto KTP anggota lain';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sensitive_identity ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_identity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_identity();