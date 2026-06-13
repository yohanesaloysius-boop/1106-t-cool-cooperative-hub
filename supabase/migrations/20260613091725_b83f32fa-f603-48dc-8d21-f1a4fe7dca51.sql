ALTER TABLE public.pinjaman
  ADD COLUMN IF NOT EXISTS cair_bank text,
  ADD COLUMN IF NOT EXISTS cair_rekening_nomor text,
  ADD COLUMN IF NOT EXISTS cair_rekening_nama text;