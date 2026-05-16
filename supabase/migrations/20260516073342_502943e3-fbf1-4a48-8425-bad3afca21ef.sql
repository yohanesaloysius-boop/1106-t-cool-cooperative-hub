
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS shopee text,
  ADD COLUMN IF NOT EXISTS promo_banner text,
  ADD COLUMN IF NOT EXISTS promo_text text;

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diskon_persen integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Increment view function (anyone can call, secured by definer)
CREATE OR REPLACE FUNCTION public.increment_product_view(_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketplace_products
  SET view_count = view_count + 1
  WHERE id = _product_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_product_view(uuid) TO anon, authenticated;
