
-- ENUMS
CREATE TYPE collection_status AS ENUM ('open','in_progress','promised','restructured','written_off','closed');
CREATE TYPE collection_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE collection_action AS ENUM ('call','visit','whatsapp','sms','letter','email','other');
CREATE TYPE collection_outcome AS ENUM ('no_contact','contacted','promise_to_pay','partial_payment','full_payment','refused','escalate');
CREATE TYPE restructure_status AS ENUM ('draft','pending','approved','rejected','active','completed');

-- collection_cases
CREATE TABLE public.collection_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pinjaman_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status collection_status NOT NULL DEFAULT 'open',
  priority collection_priority NOT NULL DEFAULT 'medium',
  hari_terlambat integer NOT NULL DEFAULT 0,
  total_tunggakan numeric NOT NULL DEFAULT 0,
  total_denda numeric NOT NULL DEFAULT 0,
  jumlah_cicilan_tertunggak integer NOT NULL DEFAULT 0,
  pic_kolektor uuid,
  catatan text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collection_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc pengurus all" ON public.collection_cases FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
CREATE POLICY "cc view own" ON public.collection_cases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX cc_status_idx ON public.collection_cases(status);
CREATE INDEX cc_user_idx ON public.collection_cases(user_id);
CREATE INDEX cc_pinjaman_idx ON public.collection_cases(pinjaman_id);

-- collection_logs
CREATE TABLE public.collection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.collection_cases(id) ON DELETE CASCADE,
  action collection_action NOT NULL,
  outcome collection_outcome NOT NULL DEFAULT 'no_contact',
  kontak_tanggal timestamptz NOT NULL DEFAULT now(),
  kontak_oleh uuid,
  isi_pembicaraan text,
  janji_bayar_tanggal date,
  janji_bayar_nominal numeric,
  lokasi text,
  lampiran_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl pengurus all" ON public.collection_logs FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
CREATE INDEX cl_case_idx ON public.collection_logs(case_id, kontak_tanggal DESC);

-- loan_restructures
CREATE TABLE public.loan_restructures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pinjaman_id uuid NOT NULL,
  case_id uuid REFERENCES public.collection_cases(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  alasan text NOT NULL,
  -- Snapshot kondisi lama
  old_sisa_pokok numeric NOT NULL DEFAULT 0,
  old_tenor_sisa integer NOT NULL DEFAULT 0,
  old_bunga_persen numeric NOT NULL DEFAULT 0,
  old_cicilan numeric NOT NULL DEFAULT 0,
  -- Kondisi baru
  new_pokok numeric NOT NULL,
  new_tenor_bulan integer NOT NULL,
  new_bunga_persen numeric NOT NULL DEFAULT 0,
  new_cicilan_per_bulan numeric NOT NULL DEFAULT 0,
  new_jatuh_tempo_mulai date NOT NULL,
  diskon_denda numeric NOT NULL DEFAULT 0,
  potongan_pokok numeric NOT NULL DEFAULT 0,
  status restructure_status NOT NULL DEFAULT 'draft',
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  effective_at date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_restructures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lr pengurus all" ON public.loan_restructures FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
CREATE POLICY "lr view own" ON public.loan_restructures FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.collection_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lr_updated BEFORE UPDATE ON public.loan_restructures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function: refresh/sync collection_cases dari angsuran yang menunggak
CREATE OR REPLACE FUNCTION public.sync_collection_cases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  -- Loop pinjaman yang punya angsuran unpaid/overdue (jatuh tempo lewat)
  FOR r IN
    SELECT
      p.id AS pinjaman_id,
      p.user_id,
      COUNT(a.id) FILTER (WHERE a.status IN ('unpaid','overdue') AND a.jatuh_tempo < CURRENT_DATE) AS jumlah_tertunggak,
      COALESCE(SUM(a.nominal) FILTER (WHERE a.status IN ('unpaid','overdue') AND a.jatuh_tempo < CURRENT_DATE), 0) AS total_tunggakan,
      COALESCE(SUM(a.denda) FILTER (WHERE a.status IN ('unpaid','overdue')), 0) AS total_denda,
      COALESCE(MAX(CURRENT_DATE - a.jatuh_tempo) FILTER (WHERE a.status IN ('unpaid','overdue')), 0) AS max_hari_terlambat
    FROM pinjaman p
    LEFT JOIN angsuran a ON a.pinjaman_id = p.id
    WHERE p.status IN ('active','disbursed','overdue')
      AND p.deleted_at IS NULL
    GROUP BY p.id, p.user_id
    HAVING COUNT(a.id) FILTER (WHERE a.status IN ('unpaid','overdue') AND a.jatuh_tempo < CURRENT_DATE) > 0
  LOOP
    -- Upsert kasus
    IF EXISTS (SELECT 1 FROM collection_cases WHERE pinjaman_id = r.pinjaman_id AND status NOT IN ('closed','written_off','restructured')) THEN
      UPDATE collection_cases
      SET hari_terlambat = r.max_hari_terlambat,
          total_tunggakan = r.total_tunggakan,
          total_denda = r.total_denda,
          jumlah_cicilan_tertunggak = r.jumlah_tertunggak,
          priority = CASE
            WHEN r.max_hari_terlambat >= 90 THEN 'critical'::collection_priority
            WHEN r.max_hari_terlambat >= 60 THEN 'high'::collection_priority
            WHEN r.max_hari_terlambat >= 30 THEN 'medium'::collection_priority
            ELSE 'low'::collection_priority
          END,
          updated_at = now()
      WHERE pinjaman_id = r.pinjaman_id AND status NOT IN ('closed','written_off','restructured');
    ELSE
      INSERT INTO collection_cases(pinjaman_id, user_id, hari_terlambat, total_tunggakan, total_denda, jumlah_cicilan_tertunggak, priority)
      VALUES (
        r.pinjaman_id, r.user_id, r.max_hari_terlambat, r.total_tunggakan, r.total_denda, r.jumlah_tertunggak,
        CASE
          WHEN r.max_hari_terlambat >= 90 THEN 'critical'::collection_priority
          WHEN r.max_hari_terlambat >= 60 THEN 'high'::collection_priority
          WHEN r.max_hari_terlambat >= 30 THEN 'medium'::collection_priority
          ELSE 'low'::collection_priority
        END
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Tutup kasus yang sudah tidak punya tunggakan
  UPDATE collection_cases
  SET status = 'closed', closed_at = now(), closed_reason = 'Tunggakan lunas'
  WHERE status NOT IN ('closed','written_off','restructured')
    AND pinjaman_id NOT IN (
      SELECT DISTINCT a.pinjaman_id FROM angsuran a
      WHERE a.status IN ('unpaid','overdue') AND a.jatuh_tempo < CURRENT_DATE
    );

  RETURN v_count;
END;
$$;
