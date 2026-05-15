-- Lowongan Kerja (Job listings) table
CREATE TYPE public.lowongan_status AS ENUM ('pending','approved','rejected','expired');

CREATE TABLE public.lowongan_kerja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  judul TEXT NOT NULL,
  perusahaan TEXT NOT NULL,
  deskripsi TEXT,
  posisi TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('pria','wanita','pria/wanita')) DEFAULT 'pria/wanita',
  lokasi TEXT,
  kontak_nama TEXT,
  kontak_telepon TEXT NOT NULL,
  kontak_email TEXT,
  status public.lowongan_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  expired_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lowongan_status ON public.lowongan_kerja(status, created_at DESC);

ALTER TABLE public.lowongan_kerja ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can view approved listings
CREATE POLICY "Approved lowongan public read"
  ON public.lowongan_kerja FOR SELECT
  USING (status = 'approved');

-- Authenticated users can view their own submissions
CREATE POLICY "Owner can read own lowongan"
  ON public.lowongan_kerja FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Pengurus can read all
CREATE POLICY "Pengurus read all lowongan"
  ON public.lowongan_kerja FOR SELECT
  TO authenticated
  USING (public.is_pengurus(auth.uid()));

-- Authenticated users can insert (status defaults pending)
CREATE POLICY "Authenticated insert lowongan"
  ON public.lowongan_kerja FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Owner can update their own pending listings
CREATE POLICY "Owner update own pending"
  ON public.lowongan_kerja FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'pending');

-- Pengurus can update (approve/reject) any
CREATE POLICY "Pengurus update lowongan"
  ON public.lowongan_kerja FOR UPDATE
  TO authenticated
  USING (public.is_pengurus(auth.uid()));

-- Pengurus can delete
CREATE POLICY "Pengurus delete lowongan"
  ON public.lowongan_kerja FOR DELETE
  TO authenticated
  USING (public.is_pengurus(auth.uid()));

CREATE TRIGGER trg_lowongan_updated_at
  BEFORE UPDATE ON public.lowongan_kerja
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed example approved listings
INSERT INTO public.lowongan_kerja (judul, perusahaan, posisi, gender, lokasi, kontak_nama, kontak_telepon, kontak_email, deskripsi, status, approved_at)
VALUES
  ('Operator Produksi', 'Koperasi T-COOL', 'Operator', 'pria/wanita', 'Jakarta', 'HRD T-COOL', '081234567890', 'hrd@tcool.id', 'Dibutuhkan operator untuk shift pagi & siang. Min. SMA/SMK, sehat jasmani.', 'approved', now()),
  ('Admin Kasir', 'Toko Mitra T-COOL', 'Admin/Kasir', 'wanita', 'Bekasi', 'Bu Sari', '082112345678', NULL, 'Pengalaman min. 1 tahun, teliti, jujur, mampu mengoperasikan komputer.', 'approved', now()),
  ('Driver Pengiriman', 'Logistik T-COOL', 'Driver', 'pria', 'Depok', 'Pak Budi', '081398765432', NULL, 'Memiliki SIM A aktif, paham wilayah Jabodetabek.', 'approved', now());
