ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foto_bg text NOT NULL DEFAULT 'white';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_foto_bg_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_foto_bg_check CHECK (foto_bg IN ('transparent', 'white'));