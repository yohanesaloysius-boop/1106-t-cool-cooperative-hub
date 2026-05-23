
-- Coupon type enum
DO $$ BEGIN
  CREATE TYPE public.mp_coupon_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  deskripsi text,
  tipe public.mp_coupon_type NOT NULL DEFAULT 'percent',
  nilai numeric(14,2) NOT NULL CHECK (nilai > 0),
  min_belanja numeric(14,2) NOT NULL DEFAULT 0,
  max_diskon numeric(14,2),
  store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  kuota integer,
  used_count integer NOT NULL DEFAULT 0,
  berlaku_dari date NOT NULL DEFAULT CURRENT_DATE,
  berlaku_sampai date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_coupons_store ON public.marketplace_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_mp_coupons_active ON public.marketplace_coupons(is_active);

ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons public read active"
  ON public.marketplace_coupons FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "coupons pengurus all"
  ON public.marketplace_coupons FOR ALL
  TO authenticated
  USING (public.is_pengurus(auth.uid()))
  WITH CHECK (public.is_pengurus(auth.uid()));

CREATE POLICY "coupons seller manage own store"
  ON public.marketplace_coupons FOR ALL
  TO authenticated
  USING (
    store_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_coupons.store_id AND s.member_id = auth.uid()
    )
  )
  WITH CHECK (
    store_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_coupons.store_id AND s.member_id = auth.uid()
    )
  );

CREATE TRIGGER mp_coupons_updated
  BEFORE UPDATE ON public.marketplace_coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
