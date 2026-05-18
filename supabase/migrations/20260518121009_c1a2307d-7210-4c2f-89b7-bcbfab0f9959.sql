
ALTER TABLE public.angsuran
  ADD COLUMN IF NOT EXISTS denda numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS denda_updated_at timestamptz;

INSERT INTO public.settings (key, value, description, is_public)
VALUES
  ('denda_persen_per_hari', '0.1'::jsonb, 'Persentase denda keterlambatan angsuran per hari (% dari nominal)', true),
  ('denda_max_persen', '30'::jsonb, 'Batas maksimum total denda terhadap nominal angsuran (%)', true)
ON CONFLICT (key) DO NOTHING;
