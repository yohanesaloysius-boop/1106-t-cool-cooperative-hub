-- 1) Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT '+62',
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- 2) Normalize phone helper (idempotent)
CREATE OR REPLACE FUNCTION public.normalize_phone_id(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(_raw, '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  -- strip leading 0 then prepend 62
  IF left(digits,1) = '0' THEN
    digits := '62' || substring(digits from 2);
  ELSIF left(digits,2) <> '62' THEN
    -- if user typed 812... assume Indonesia
    IF left(digits,1) = '8' THEN
      digits := '62' || digits;
    END IF;
  END IF;
  RETURN '+' || digits;
END;
$$;

-- 3) Backfill existing no_hp
UPDATE public.profiles
SET no_hp = public.normalize_phone_id(no_hp)
WHERE no_hp IS NOT NULL AND no_hp NOT LIKE '+%';

-- 4) Unique index on no_hp (case where not null + not deleted)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_no_hp_unique
  ON public.profiles (no_hp)
  WHERE no_hp IS NOT NULL AND deleted_at IS NULL;

-- 5) RPC to lookup email by phone (for login flow). SECURITY DEFINER, restricted.
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text;
  _email text;
BEGIN
  _normalized := public.normalize_phone_id(_phone);
  IF _normalized IS NULL THEN RETURN NULL; END IF;
  SELECT p.email INTO _email
  FROM public.profiles p
  WHERE p.no_hp = _normalized
    AND p.deleted_at IS NULL
  LIMIT 1;
  RETURN _email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;