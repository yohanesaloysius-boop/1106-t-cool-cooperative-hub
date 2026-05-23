
-- Repoint profile + roles dari UUID lama ke UUID auth aktif untuk yohanesaloysius@gmail.com
DO $$
DECLARE
  old_id uuid := '52ce0fe4-ce11-4fef-bd9d-9b20bb7032a3';
  new_id uuid := '4cc2c87c-9bf0-450d-aeaa-6adfd6db4941';
BEGIN
  -- Hapus profile/role kosong yang mungkin sudah otomatis dibuat untuk new_id
  DELETE FROM public.user_roles WHERE user_id = new_id;
  DELETE FROM public.profiles WHERE id = new_id;

  -- Pindahkan profile lama ke id baru
  UPDATE public.profiles SET id = new_id WHERE id = old_id;
  UPDATE public.user_roles SET user_id = new_id WHERE user_id = old_id;
END $$;

-- Pastikan ada role super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('4cc2c87c-9bf0-450d-aeaa-6adfd6db4941', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
