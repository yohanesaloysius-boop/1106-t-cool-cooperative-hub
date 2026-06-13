REVOKE EXECUTE ON FUNCTION public.normalize_simpanan_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_simpanan_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.normalize_simpanan_status() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.simpanan_on_approved() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.simpanan_on_approved() FROM anon;
REVOKE EXECUTE ON FUNCTION public.simpanan_on_approved() FROM authenticated;