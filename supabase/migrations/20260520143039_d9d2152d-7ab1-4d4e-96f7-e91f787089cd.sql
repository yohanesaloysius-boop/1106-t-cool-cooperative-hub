
-- Enum
DO $$ BEGIN
  CREATE TYPE public.asset_kategori AS ENUM ('kendaraan','properti','peralatan','elektronik','lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_status AS ENUM ('aktif','dijual','rusak','dihapus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_kondisi AS ENUM ('baik','perlu_perbaikan','rusak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabel assets
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_aset text UNIQUE NOT NULL,
  nama text NOT NULL,
  kategori public.asset_kategori NOT NULL DEFAULT 'lainnya',
  deskripsi text,
  tanggal_perolehan date NOT NULL,
  harga_perolehan numeric NOT NULL DEFAULT 0,
  umur_ekonomis_bulan integer NOT NULL DEFAULT 60,
  nilai_residu numeric NOT NULL DEFAULT 0,
  lokasi text,
  kondisi public.asset_kondisi NOT NULL DEFAULT 'baik',
  status public.asset_status NOT NULL DEFAULT 'aktif',
  penanggung_jawab uuid,
  foto_url text,
  dokumen_url text,
  catatan text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_assets_kategori ON public.assets(kategori);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets pengurus all" ON public.assets
  FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid()))
  WITH CHECK (public.is_pengurus(auth.uid()));

CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabel asset_depreciations
CREATE TABLE IF NOT EXISTS public.asset_depreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  periode date NOT NULL, -- tanggal 1 bulan
  beban_bulan numeric NOT NULL DEFAULT 0,
  akumulasi numeric NOT NULL DEFAULT 0,
  nilai_buku numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_asset_dep_asset ON public.asset_depreciations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_dep_periode ON public.asset_depreciations(periode);

ALTER TABLE public.asset_depreciations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_dep pengurus all" ON public.asset_depreciations
  FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid()))
  WITH CHECK (public.is_pengurus(auth.uid()));

-- Fungsi hitung penyusutan garis lurus untuk 1 aset, hingga bulan berjalan
CREATE OR REPLACE FUNCTION public.compute_asset_depreciation(_asset_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.assets%ROWTYPE;
  v_beban numeric;
  v_periode date;
  v_end date;
  v_n integer := 0;
  v_akum numeric := 0;
  v_max_akum numeric;
BEGIN
  IF NOT public.is_pengurus(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT * INTO a FROM public.assets WHERE id = _asset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aset tidak ditemukan'; END IF;
  IF a.umur_ekonomis_bulan <= 0 THEN RAISE EXCEPTION 'Umur ekonomis harus > 0'; END IF;

  v_beban := GREATEST((a.harga_perolehan - a.nilai_residu) / a.umur_ekonomis_bulan, 0);
  v_max_akum := GREATEST(a.harga_perolehan - a.nilai_residu, 0);

  -- mulai dari bulan setelah perolehan
  v_periode := date_trunc('month', a.tanggal_perolehan)::date + interval '1 month';
  v_end := date_trunc('month', CURRENT_DATE)::date;

  -- hapus snapshot lama supaya idempotent
  DELETE FROM public.asset_depreciations WHERE asset_id = _asset_id;

  WHILE v_periode <= v_end LOOP
    v_akum := LEAST(v_akum + v_beban, v_max_akum);
    INSERT INTO public.asset_depreciations (asset_id, periode, beban_bulan, akumulasi, nilai_buku)
    VALUES (_asset_id, v_periode,
            CASE WHEN v_akum >= v_max_akum AND v_n > 0 AND v_akum = v_max_akum THEN v_max_akum - (v_akum - v_beban) ELSE v_beban END,
            v_akum,
            a.harga_perolehan - v_akum);
    v_n := v_n + 1;
    v_periode := (v_periode + interval '1 month')::date;
    EXIT WHEN v_akum >= v_max_akum;
  END LOOP;

  RETURN v_n;
END $$;
