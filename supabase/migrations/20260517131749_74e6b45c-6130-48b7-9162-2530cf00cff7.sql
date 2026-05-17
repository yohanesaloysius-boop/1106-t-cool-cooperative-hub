DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_products_store_id_fkey') THEN
    ALTER TABLE public.marketplace_products ADD CONSTRAINT marketplace_products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.marketplace_stores(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_products_category_id_fkey') THEN
    ALTER TABLE public.marketplace_products ADD CONSTRAINT marketplace_products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.marketplace_categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_stores_member_id_fkey') THEN
    ALTER TABLE public.marketplace_stores ADD CONSTRAINT marketplace_stores_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_transactions_product_id_fkey') THEN
    ALTER TABLE public.marketplace_transactions ADD CONSTRAINT marketplace_transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.marketplace_products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_transactions_store_id_fkey') THEN
    ALTER TABLE public.marketplace_transactions ADD CONSTRAINT marketplace_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.marketplace_stores(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_transactions_buyer_id_fkey') THEN
    ALTER TABLE public.marketplace_transactions ADD CONSTRAINT marketplace_transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_transactions_seller_id_fkey') THEN
    ALTER TABLE public.marketplace_transactions ADD CONSTRAINT marketplace_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_favorites_product_id_fkey') THEN
    ALTER TABLE public.marketplace_favorites ADD CONSTRAINT marketplace_favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.marketplace_products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_favorites_member_id_fkey') THEN
    ALTER TABLE public.marketplace_favorites ADD CONSTRAINT marketplace_favorites_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_reviews_product_id_fkey') THEN
    ALTER TABLE public.marketplace_reviews ADD CONSTRAINT marketplace_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.marketplace_products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_reviews_member_id_fkey') THEN
    ALTER TABLE public.marketplace_reviews ADD CONSTRAINT marketplace_reviews_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';