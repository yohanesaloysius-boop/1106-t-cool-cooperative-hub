
-- Enums
DO $$ BEGIN
  CREATE TYPE public.budget_status AS ENUM ('draft','disahkan','ditutup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.budget_item_jenis AS ENUM ('pendapatan','beban');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.budget_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tahun integer NOT NULL,
  judul text NOT NULL,
  status public.budget_status NOT NULL DEFAULT 'draft',
  catatan text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tahun)
);

CREATE TABLE IF NOT EXISTS public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.budget_plans(id) ON DELETE CASCADE,
  jenis public.budget_item_jenis NOT NULL,
  kategori text NOT NULL,
  sub_kategori text,
  target_nominal numeric(15,2) NOT NULL DEFAULT 0,
  catatan text,
  urutan integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_plan ON public.budget_items(plan_id, jenis, urutan);

-- Triggers
DROP TRIGGER IF EXISTS budget_plans_updated_at ON public.budget_plans;
CREATE TRIGGER budget_plans_updated_at BEFORE UPDATE ON public.budget_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS budget_items_updated_at ON public.budget_items;
CREATE TRIGGER budget_items_updated_at BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_plans pengurus all" ON public.budget_plans;
CREATE POLICY "budget_plans pengurus all" ON public.budget_plans
  TO authenticated USING (public.is_pengurus(auth.uid()))
  WITH CHECK (public.is_pengurus(auth.uid()));

DROP POLICY IF EXISTS "budget_items pengurus all" ON public.budget_items;
CREATE POLICY "budget_items pengurus all" ON public.budget_items
  TO authenticated USING (public.is_pengurus(auth.uid()))
  WITH CHECK (public.is_pengurus(auth.uid()));

-- Realisasi function
CREATE OR REPLACE FUNCTION public.get_rapb_realisasi(_plan_id uuid)
RETURNS TABLE (
  item_id uuid,
  jenis public.budget_item_jenis,
  kategori text,
  sub_kategori text,
  target_nominal numeric,
  realisasi numeric,
  persen numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tahun integer;
BEGIN
  SELECT tahun INTO v_tahun FROM public.budget_plans WHERE id = _plan_id;
  IF v_tahun IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    bi.id,
    bi.jenis,
    bi.kategori,
    bi.sub_kategori,
    bi.target_nominal,
    COALESCE(
      CASE
        WHEN bi.jenis = 'beban' THEN (
          SELECT SUM(oe.jumlah)::numeric
          FROM public.opex_expenses oe
          LEFT JOIN public.opex_categories oc ON oc.id = oe.category_id
          WHERE EXTRACT(YEAR FROM oe.tanggal) = v_tahun
            AND (LOWER(COALESCE(oc.nama,'')) = LOWER(bi.kategori)
                 OR LOWER(COALESCE(oe.keterangan,'')) LIKE '%' || LOWER(bi.kategori) || '%')
        )
        WHEN bi.jenis = 'pendapatan' THEN (
          SELECT SUM(t.jumlah)::numeric
          FROM public.transaksi t
          WHERE EXTRACT(YEAR FROM t.created_at) = v_tahun
            AND LOWER(COALESCE(t.jenis,'')) LIKE '%' || LOWER(bi.kategori) || '%'
        )
      END, 0
    ) AS realisasi,
    CASE WHEN bi.target_nominal > 0
      THEN ROUND(COALESCE(
        CASE
          WHEN bi.jenis = 'beban' THEN (
            SELECT SUM(oe.jumlah)::numeric
            FROM public.opex_expenses oe
            LEFT JOIN public.opex_categories oc ON oc.id = oe.category_id
            WHERE EXTRACT(YEAR FROM oe.tanggal) = v_tahun
              AND (LOWER(COALESCE(oc.nama,'')) = LOWER(bi.kategori)
                   OR LOWER(COALESCE(oe.keterangan,'')) LIKE '%' || LOWER(bi.kategori) || '%')
          )
          WHEN bi.jenis = 'pendapatan' THEN (
            SELECT SUM(t.jumlah)::numeric
            FROM public.transaksi t
            WHERE EXTRACT(YEAR FROM t.created_at) = v_tahun
              AND LOWER(COALESCE(t.jenis,'')) LIKE '%' || LOWER(bi.kategori) || '%'
          )
        END, 0) / bi.target_nominal * 100, 2)
      ELSE 0
    END AS persen
  FROM public.budget_items bi
  WHERE bi.plan_id = _plan_id
  ORDER BY bi.jenis, bi.urutan;
END;
$$;
