
-- 1) Local-format normalizer (output 08...)
CREATE OR REPLACE FUNCTION public.normalize_phone_local(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(_raw, '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  IF left(digits,2) = '62' THEN
    digits := '0' || substring(digits from 3);
  ELSIF left(digits,1) = '8' THEN
    digits := '0' || digits;
  ELSIF left(digits,1) <> '0' THEN
    digits := '0' || digits;
  END IF;
  RETURN digits;
END;
$function$;

-- 2) Robust phone -> email lookup (matches any input/stored format)
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _normalized text;
  _email text;
BEGIN
  _normalized := public.normalize_phone_local(_phone);
  IF _normalized IS NULL THEN RETURN NULL; END IF;
  SELECT p.email INTO _email
  FROM public.profiles p
  WHERE public.normalize_phone_local(p.no_hp) = _normalized
    AND p.deleted_at IS NULL
  LIMIT 1;
  RETURN _email;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.normalize_phone_local(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;

-- 3) Migrate existing stored numbers to local 08... format
UPDATE public.profiles
SET no_hp = public.normalize_phone_local(no_hp)
WHERE no_hp IS NOT NULL
  AND no_hp <> public.normalize_phone_local(no_hp);
