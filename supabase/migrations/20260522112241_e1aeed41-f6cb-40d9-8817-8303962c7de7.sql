
-- Index for faster matching
CREATE INDEX IF NOT EXISTS idx_budget_items_kategori ON public.budget_items(LOWER(kategori));

-- RPC: cek status anggaran untuk kategori OPEX tertentu di tahun berjalan
CREATE OR REPLACE FUNCTION public.get_opex_budget_status(_category_id uuid, _tahun integer)
RETURNS TABLE (
  has_budget boolean,
  target_nominal numeric,
  realisasi numeric,
  sisa numeric,
  persen numeric,
  item_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kategori text;
  v_target numeric := 0;
  v_real numeric := 0;
  v_label text;
  v_plan_id uuid;
BEGIN
  SELECT LOWER(nama) INTO v_kategori FROM public.opex_categories WHERE id = _category_id;
  IF v_kategori IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  SELECT id INTO v_plan_id FROM public.budget_plans
    WHERE tahun = _tahun AND status IN ('disahkan','draft')
    ORDER BY (status = 'disahkan') DESC LIMIT 1;
  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  SELECT SUM(target_nominal), MAX(kategori) INTO v_target, v_label
    FROM public.budget_items
    WHERE plan_id = v_plan_id AND jenis = 'beban'
      AND LOWER(kategori) = v_kategori;

  IF v_target IS NULL OR v_target = 0 THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, 0::numeric, NULL::text;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(oe.nominal),0) INTO v_real
    FROM public.opex_expenses oe
    LEFT JOIN public.opex_categories oc ON oc.id = oe.category_id
    WHERE oe.category_id = _category_id
      AND EXTRACT(YEAR FROM oe.tanggal) = _tahun
      AND oe.status IN ('approved','paid','pending')
      AND oe.deleted_at IS NULL;

  RETURN QUERY SELECT true, v_target, v_real, (v_target - v_real), ROUND(v_real / v_target * 100, 2), v_label;
END;
$$;
