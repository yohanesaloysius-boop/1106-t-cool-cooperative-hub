CREATE OR REPLACE FUNCTION public.get_public_tentang()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(
      (SELECT jsonb_object_agg(replace(key, 'tentang.', ''), value)
       FROM public.settings WHERE key LIKE 'tentang.%'),
      '{}'::jsonb
    )
    || jsonb_build_object(
      'logo_url',
      COALESCE((SELECT value FROM public.settings WHERE key = 'koperasi.logo_url'), '""'::jsonb),
      'logo_fit',
      COALESCE((SELECT value FROM public.settings WHERE key = 'koperasi.logo_fit'), '"contain"'::jsonb)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tentang() TO anon, authenticated;