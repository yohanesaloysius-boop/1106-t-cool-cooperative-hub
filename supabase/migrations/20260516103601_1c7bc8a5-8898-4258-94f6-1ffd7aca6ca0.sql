
ALTER TABLE public.lowongan_kerja DROP CONSTRAINT IF EXISTS lowongan_kerja_approved_by_fkey;
ALTER TABLE public.simpanan DROP CONSTRAINT IF EXISTS simpanan_user_id_fkey;
ALTER TABLE public.simpanan DROP CONSTRAINT IF EXISTS simpanan_verified_by_fkey;
ALTER TABLE public.simpanan DROP CONSTRAINT IF EXISTS simpanan_created_by_fkey;
ALTER TABLE public.pinjaman DROP CONSTRAINT IF EXISTS pinjaman_user_id_fkey;
ALTER TABLE public.pinjaman DROP CONSTRAINT IF EXISTS pinjaman_created_by_fkey;
ALTER TABLE public.marketplace_stores DROP CONSTRAINT IF EXISTS marketplace_stores_member_id_fkey;
ALTER TABLE public.marketplace_transactions DROP CONSTRAINT IF EXISTS marketplace_transactions_buyer_id_fkey;
ALTER TABLE public.marketplace_transactions DROP CONSTRAINT IF EXISTS marketplace_transactions_seller_id_fkey;
ALTER TABLE public.marketplace_products DROP CONSTRAINT IF EXISTS marketplace_products_store_id_fkey;
ALTER TABLE public.marketplace_products DROP CONSTRAINT IF EXISTS marketplace_products_category_id_fkey;
ALTER TABLE public.marketplace_transactions DROP CONSTRAINT IF EXISTS marketplace_transactions_product_id_fkey;
ALTER TABLE public.marketplace_transactions DROP CONSTRAINT IF EXISTS marketplace_transactions_store_id_fkey;
