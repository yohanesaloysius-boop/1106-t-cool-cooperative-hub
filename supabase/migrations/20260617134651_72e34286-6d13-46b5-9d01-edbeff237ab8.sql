-- ===== Defense-in-depth: batasi nominal uang di level database =====
-- Semua data existing sudah diverifikasi tidak ada yang melanggar.

-- Simpanan: min Rp 1.000, max Rp 1 miliar
ALTER TABLE public.simpanan DROP CONSTRAINT IF EXISTS simpanan_nominal_check;
ALTER TABLE public.simpanan ADD CONSTRAINT simpanan_nominal_check
  CHECK (nominal >= 1000 AND nominal <= 1000000000);

-- Pinjaman: nominal, tenor, bunga
ALTER TABLE public.pinjaman DROP CONSTRAINT IF EXISTS pinjaman_nominal_check;
ALTER TABLE public.pinjaman ADD CONSTRAINT pinjaman_nominal_check
  CHECK (nominal >= 1000 AND nominal <= 1000000000);
ALTER TABLE public.pinjaman DROP CONSTRAINT IF EXISTS pinjaman_tenor_bulan_check;
ALTER TABLE public.pinjaman ADD CONSTRAINT pinjaman_tenor_bulan_check
  CHECK (tenor_bulan >= 1 AND tenor_bulan <= 60);
ALTER TABLE public.pinjaman DROP CONSTRAINT IF EXISTS pinjaman_bunga_persen_check;
ALTER TABLE public.pinjaman ADD CONSTRAINT pinjaman_bunga_persen_check
  CHECK (bunga_persen >= 0 AND bunga_persen <= 20);

-- Angsuran: tidak negatif, max Rp 1 miliar
ALTER TABLE public.angsuran DROP CONSTRAINT IF EXISTS angsuran_nominal_check;
ALTER TABLE public.angsuran ADD CONSTRAINT angsuran_nominal_check
  CHECK (nominal >= 0 AND nominal <= 1000000000);

-- QRIS: max Rp 1 miliar (sudah ada > 0)
ALTER TABLE public.qris_payments DROP CONSTRAINT IF EXISTS qris_payments_nominal_check;
ALTER TABLE public.qris_payments ADD CONSTRAINT qris_payments_nominal_check
  CHECK (nominal > 0 AND nominal <= 1000000000);

-- Mutasi dompet: tidak negatif
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_nominal_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_nominal_check
  CHECK (nominal >= 0 AND nominal <= 1000000000);

-- Iuran tertunda: tidak negatif
ALTER TABLE public.pending_iuran DROP CONSTRAINT IF EXISTS pending_iuran_nominal_check;
ALTER TABLE public.pending_iuran ADD CONSTRAINT pending_iuran_nominal_check
  CHECK (nominal >= 0 AND nominal <= 1000000000);