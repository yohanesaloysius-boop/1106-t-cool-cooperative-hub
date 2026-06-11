
-- 1) search_path = public untuk fungsi yang masih mutable
ALTER FUNCTION public.church_pr_calc_fee()        SET search_path = public;
ALTER FUNCTION public.church_pr_log_audit()       SET search_path = public;
ALTER FUNCTION public.church_pr_set_number()      SET search_path = public;
ALTER FUNCTION public.school_pr_calc_fee()        SET search_path = public;
ALTER FUNCTION public.school_pr_log_audit()       SET search_path = public;
ALTER FUNCTION public.school_pr_set_number()      SET search_path = public;
ALTER FUNCTION public.gen_qris_invoice_no()       SET search_path = public;
ALTER FUNCTION public.normalize_phone_id(text)    SET search_path = public;
ALTER FUNCTION public.set_updated_at()            SET search_path = public;
ALTER FUNCTION public.touch_updated_at()          SET search_path = public;
ALTER FUNCTION public.is_sa_identity(text, text)  SET search_path = public;

-- 2) Revoke semua execute dari PUBLIC/anon/authenticated, grant ke service_role
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 3) Fungsi publik (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.get_public_koperasi_stats()           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_lowongan(integer)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_recent_activity(integer)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_featured_products(integer)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products(integer)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_stats()               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_view(uuid)          TO anon, authenticated;

-- 4) RLS helper (dipakai di policy)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pengurus(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ketua(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_seller(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_church_requester(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_requester(uuid)             TO authenticated;

-- 5) Aksi user / pengurus
GRANT EXECUTE ON FUNCTION public.approve_member(uuid)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_rat_vote(uuid, jsonb)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_guarantor_request(uuid, text, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_confirm_received(uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_file_complaint(uuid, text, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_resolve_complaint(uuid, text, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_ship(uuid, text, text)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_upload_bukti(uuid, text)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_verify_payment(uuid)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_set_store_status(uuid, store_status, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_review_loan_verification(uuid, text, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_process_withdrawal(uuid, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_reject_withdrawal(uuid, text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_admin_stats()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_marketplace_activity(uuid, integer)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_jurnal_umum(date, date)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fee_breakdown()                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_ledger(uuid, date, date)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_opex_budget_status(uuid, integer)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rapb_realisasi(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rat_voting_result(uuid)                       TO authenticated;
