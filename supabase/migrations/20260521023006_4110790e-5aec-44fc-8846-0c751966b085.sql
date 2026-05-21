CREATE TYPE opex_status AS ENUM ('draft','pending','approved','rejected','paid','cancelled');
CREATE TYPE opex_metode_bayar AS ENUM ('tunai','transfer','wallet','lainnya');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.opex_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL UNIQUE,
  nama text NOT NULL,
  deskripsi text,
  pajak_jenis text,
  pajak_tarif numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opex_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opex_cat pengurus all" ON public.opex_categories FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
CREATE POLICY "opex_cat read auth" ON public.opex_categories FOR SELECT TO authenticated USING (true);

CREATE TABLE public.opex_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_bukti text,
  category_id uuid NOT NULL REFERENCES public.opex_categories(id),
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  deskripsi text NOT NULL,
  nominal numeric NOT NULL CHECK (nominal >= 0),
  penerima text,
  metode_bayar opex_metode_bayar NOT NULL DEFAULT 'transfer',
  status opex_status NOT NULL DEFAULT 'draft',
  bukti_url text,
  pajak_nominal numeric NOT NULL DEFAULT 0,
  pajak_meta jsonb,
  catatan text,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  paid_at timestamptz,
  paid_by uuid,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_opex_tanggal ON public.opex_expenses(tanggal DESC);
CREATE INDEX idx_opex_status ON public.opex_expenses(status);
CREATE INDEX idx_opex_category ON public.opex_expenses(category_id);
ALTER TABLE public.opex_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opex pengurus all" ON public.opex_expenses FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE TRIGGER trg_opex_cat_updated BEFORE UPDATE ON public.opex_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_opex_exp_updated BEFORE UPDATE ON public.opex_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.opex_categories (kode, nama, pajak_jenis, pajak_tarif) VALUES
  ('gaji', 'Gaji Pengurus & Karyawan', 'pph21', 5),
  ('jasa', 'Jasa Profesional / Vendor', 'pph23', 2),
  ('sewa', 'Sewa Kantor & Ruang', NULL, 0),
  ('listrik', 'Listrik, Air, Internet', NULL, 0),
  ('atk', 'ATK & Perlengkapan Kantor', NULL, 0),
  ('lainnya', 'Operasional Lainnya', NULL, 0);
