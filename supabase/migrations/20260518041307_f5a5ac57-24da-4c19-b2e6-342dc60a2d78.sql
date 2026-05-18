
REVOKE EXECUTE ON FUNCTION public.get_or_create_wallet(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mp_upload_bukti(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mp_verify_payment(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mp_ship(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mp_confirm_received(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mp_process_withdrawal(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mp_reject_withdrawal(uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.mp_upload_bukti(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_verify_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_ship(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_confirm_received(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_process_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_reject_withdrawal(uuid, text) TO authenticated;
