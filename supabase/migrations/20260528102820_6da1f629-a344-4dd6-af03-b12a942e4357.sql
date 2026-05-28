
CREATE INDEX IF NOT EXISTS idx_angsuran_pinjaman_id ON public.angsuran(pinjaman_id);
CREATE INDEX IF NOT EXISTS idx_angsuran_user_id ON public.angsuran(user_id);
CREATE INDEX IF NOT EXISTS idx_church_pr_receipts_pr_id ON public.church_pr_receipts(pr_id);
CREATE INDEX IF NOT EXISTS idx_church_purchase_orders_vendor_id ON public.church_purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_church_requesters_division_id ON public.church_requesters(division_id);
CREATE INDEX IF NOT EXISTS idx_loan_restructures_case_id ON public.loan_restructures(case_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_created_by ON public.marketplace_coupons(created_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_favorites_product_id ON public.marketplace_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_member_id ON public.marketplace_reviews(member_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_store_id ON public.marketplace_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting_id ON public.meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_official_letters_generated_by ON public.official_letters(generated_by);
CREATE INDEX IF NOT EXISTS idx_pinjaman_user_id ON public.pinjaman(user_id);
CREATE INDEX IF NOT EXISTS idx_pinjaman_verification_id ON public.pinjaman(verification_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_school_pr_receipts_pr_id ON public.school_pr_receipts(pr_id);
CREATE INDEX IF NOT EXISTS idx_school_purchase_orders_vendor_id ON public.school_purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_school_requesters_division_id ON public.school_requesters(division_id);
CREATE INDEX IF NOT EXISTS idx_simpanan_user_id ON public.simpanan(user_id);

CREATE INDEX IF NOT EXISTS idx_angsuran_status_jt ON public.angsuran(status, jatuh_tempo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pinjaman_status ON public.pinjaman(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_simpanan_status ON public.simpanan(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_buyer ON public.marketplace_transactions(buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_seller ON public.marketplace_transactions(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status) WHERE deleted_at IS NULL;
