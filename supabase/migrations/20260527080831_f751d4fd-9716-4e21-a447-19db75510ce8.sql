
-- Add FK from operational tables to public.profiles so PostgREST can embed profile fields.
-- profiles.id mirrors auth.users.id, so values already align.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simpanan_user_id_profiles_fkey') THEN
    ALTER TABLE public.simpanan
      ADD CONSTRAINT simpanan_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'angsuran_user_id_profiles_fkey') THEN
    ALTER TABLE public.angsuran
      ADD CONSTRAINT angsuran_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pinjaman' AND column_name='user_id')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pinjaman_user_id_profiles_fkey') THEN
    ALTER TABLE public.pinjaman
      ADD CONSTRAINT pinjaman_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shu_user_id_profiles_fkey') THEN
    ALTER TABLE public.shu
      ADD CONSTRAINT shu_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transaksi' AND column_name='user_id')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaksi_user_id_profiles_fkey') THEN
    ALTER TABLE public.transaksi
      ADD CONSTRAINT transaksi_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Reload PostgREST schema cache so the new relationships are picked up immediately
NOTIFY pgrst, 'reload schema';
