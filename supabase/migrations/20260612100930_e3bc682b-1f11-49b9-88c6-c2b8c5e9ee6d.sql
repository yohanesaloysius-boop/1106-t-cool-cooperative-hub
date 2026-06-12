GRANT SELECT ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_letters TO authenticated;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.official_letters TO service_role;