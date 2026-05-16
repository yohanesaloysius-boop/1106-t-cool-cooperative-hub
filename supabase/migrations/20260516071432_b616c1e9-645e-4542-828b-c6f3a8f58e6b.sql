
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.store_status AS ENUM ('active','inactive','suspended');
CREATE TYPE public.product_status AS ENUM ('draft','active','out_of_stock','archived');
CREATE TYPE public.mp_trx_status AS ENUM ('pending','confirmed','paid','shipped','completed','cancelled');

-- =========================================
-- CATEGORIES
-- =========================================
CREATE TABLE public.marketplace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kategori text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================
-- STORES
-- =========================================
CREATE TABLE public.marketplace_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  nama_toko text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo text,
  banner text,
  deskripsi text,
  whatsapp text,
  alamat text,
  status_toko public.store_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_stores_member ON public.marketplace_stores(member_id);
CREATE INDEX idx_mp_stores_status ON public.marketplace_stores(status_toko);

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE public.marketplace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  nama_produk text NOT NULL,
  slug text NOT NULL,
  harga numeric(14,2) NOT NULL DEFAULT 0 CHECK (harga >= 0),
  stok integer NOT NULL DEFAULT 0 CHECK (stok >= 0),
  deskripsi text,
  gambar_produk text[] NOT NULL DEFAULT '{}',
  status_produk public.product_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, slug)
);
CREATE INDEX idx_mp_products_store ON public.marketplace_products(store_id);
CREATE INDEX idx_mp_products_category ON public.marketplace_products(category_id);
CREATE INDEX idx_mp_products_status ON public.marketplace_products(status_produk);

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TABLE public.marketplace_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  harga_satuan numeric(14,2) NOT NULL CHECK (harga_satuan >= 0),
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  status public.mp_trx_status NOT NULL DEFAULT 'pending',
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_trx_buyer ON public.marketplace_transactions(buyer_id);
CREATE INDEX idx_mp_trx_seller ON public.marketplace_transactions(seller_id);
CREATE INDEX idx_mp_trx_product ON public.marketplace_transactions(product_id);

-- =========================================
-- REVIEWS
-- =========================================
CREATE TABLE public.marketplace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  komentar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, member_id)
);
CREATE INDEX idx_mp_reviews_product ON public.marketplace_reviews(product_id);

-- =========================================
-- FAVORITES
-- =========================================
CREATE TABLE public.marketplace_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, product_id)
);
CREATE INDEX idx_mp_fav_member ON public.marketplace_favorites(member_id);

-- =========================================
-- TRIGGERS updated_at
-- =========================================
CREATE TRIGGER mp_categories_updated BEFORE UPDATE ON public.marketplace_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mp_stores_updated BEFORE UPDATE ON public.marketplace_stores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mp_products_updated BEFORE UPDATE ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mp_trx_updated BEFORE UPDATE ON public.marketplace_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mp_reviews_updated BEFORE UPDATE ON public.marketplace_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- ENABLE RLS
-- =========================================
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_favorites ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLICIES: categories (publik read, pengurus manage)
-- =========================================
CREATE POLICY "categories public read" ON public.marketplace_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories pengurus manage" ON public.marketplace_categories FOR ALL TO authenticated USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

-- =========================================
-- POLICIES: stores
-- =========================================
CREATE POLICY "stores public read active" ON public.marketplace_stores FOR SELECT TO anon, authenticated USING (status_toko = 'active' OR auth.uid() = member_id OR is_pengurus(auth.uid()));
CREATE POLICY "stores insert own" ON public.marketplace_stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "stores update own or pengurus" ON public.marketplace_stores FOR UPDATE TO authenticated USING (auth.uid() = member_id OR is_pengurus(auth.uid())) WITH CHECK (auth.uid() = member_id OR is_pengurus(auth.uid()));
CREATE POLICY "stores delete pengurus" ON public.marketplace_stores FOR DELETE TO authenticated USING (is_pengurus(auth.uid()));

-- =========================================
-- POLICIES: products
-- =========================================
CREATE POLICY "products public read active" ON public.marketplace_products FOR SELECT TO anon, authenticated
  USING (
    status_produk = 'active'
    OR EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = store_id AND s.member_id = auth.uid())
    OR is_pengurus(auth.uid())
  );
CREATE POLICY "products insert own store" ON public.marketplace_products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = store_id AND s.member_id = auth.uid()));
CREATE POLICY "products update own store or pengurus" ON public.marketplace_products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = store_id AND s.member_id = auth.uid()) OR is_pengurus(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = store_id AND s.member_id = auth.uid()) OR is_pengurus(auth.uid()));
CREATE POLICY "products delete own store or pengurus" ON public.marketplace_products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = store_id AND s.member_id = auth.uid()) OR is_pengurus(auth.uid()));

-- =========================================
-- POLICIES: transactions
-- =========================================
CREATE POLICY "trx view buyer seller pengurus" ON public.marketplace_transactions FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR is_pengurus(auth.uid()));
CREATE POLICY "trx insert as buyer" ON public.marketplace_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "trx update seller or pengurus" ON public.marketplace_transactions FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id OR is_pengurus(auth.uid())) WITH CHECK (auth.uid() = seller_id OR is_pengurus(auth.uid()));

-- =========================================
-- POLICIES: reviews
-- =========================================
CREATE POLICY "reviews public read" ON public.marketplace_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews insert own" ON public.marketplace_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "reviews update own" ON public.marketplace_reviews FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "reviews delete own or pengurus" ON public.marketplace_reviews FOR DELETE TO authenticated USING (auth.uid() = member_id OR is_pengurus(auth.uid()));

-- =========================================
-- POLICIES: favorites
-- =========================================
CREATE POLICY "fav view own" ON public.marketplace_favorites FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY "fav insert own" ON public.marketplace_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "fav delete own" ON public.marketplace_favorites FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- =========================================
-- STORAGE BUCKET marketplace (publik)
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace','marketplace', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mp storage public read" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace');
CREATE POLICY "mp storage user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mp storage user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "mp storage user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================
-- SEED CATEGORIES
-- =========================================
INSERT INTO public.marketplace_categories (nama_kategori, slug, icon) VALUES
  ('Kuliner','kuliner','UtensilsCrossed'),
  ('Fashion','fashion','Shirt'),
  ('Elektronik','elektronik','Smartphone'),
  ('Pertanian','pertanian','Sprout'),
  ('Jasa','jasa','Briefcase'),
  ('Kerajinan','kerajinan','Palette'),
  ('Kesehatan','kesehatan','HeartPulse'),
  ('Lainnya','lainnya','Package')
ON CONFLICT (nama_kategori) DO NOTHING;
