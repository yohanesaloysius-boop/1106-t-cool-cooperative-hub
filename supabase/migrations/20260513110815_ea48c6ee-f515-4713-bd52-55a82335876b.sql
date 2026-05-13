
-- Enums
CREATE TYPE public.app_role AS ENUM ('super_admin','ketua','sekretaris','bendahara','anggota');
CREATE TYPE public.member_status AS ENUM ('pending','active','suspended','rejected');
CREATE TYPE public.simpanan_jenis AS ENUM ('pokok','wajib','sukarela');
CREATE TYPE public.bunga_jenis AS ENUM ('flat','efektif','menurun');
CREATE TYPE public.pinjaman_status AS ENUM ('draft','pending_sekretaris','pending_bendahara','pending_ketua','approved','rejected','disbursed','completed','cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending','verified','rejected');
CREATE TYPE public.angsuran_status AS ENUM ('unpaid','pending','paid','overdue');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nomor_anggota TEXT UNIQUE,
  nama_lengkap TEXT NOT NULL,
  nik TEXT,
  tempat_lahir TEXT,
  tanggal_lahir DATE,
  jenis_kelamin TEXT,
  alamat TEXT,
  no_hp TEXT,
  email TEXT,
  pekerjaan TEXT,
  foto_url TEXT,
  ktp_url TEXT,
  status public.member_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_pengurus(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin','ketua','sekretaris','bendahara')
  )
$$;

-- simpanan
CREATE TABLE public.simpanan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jenis public.simpanan_jenis NOT NULL,
  nominal NUMERIC(15,2) NOT NULL CHECK (nominal > 0),
  bukti_url TEXT,
  catatan TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pinjaman
CREATE TABLE public.pinjaman (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nominal NUMERIC(15,2) NOT NULL CHECK (nominal > 0),
  tenor_bulan INT NOT NULL CHECK (tenor_bulan > 0),
  bunga_persen NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  bunga_jenis public.bunga_jenis NOT NULL DEFAULT 'flat',
  tujuan TEXT,
  dokumen_url TEXT,
  status public.pinjaman_status NOT NULL DEFAULT 'draft',
  cicilan_per_bulan NUMERIC(15,2),
  total_bayar NUMERIC(15,2),
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  bukti_pencairan_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- angsuran
CREATE TABLE public.angsuran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pinjaman_id UUID NOT NULL REFERENCES public.pinjaman(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cicilan_ke INT NOT NULL,
  jatuh_tempo DATE NOT NULL,
  nominal NUMERIC(15,2) NOT NULL,
  bukti_url TEXT,
  paid_at TIMESTAMPTZ,
  status public.angsuran_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shu
CREATE TABLE public.shu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tahun INT NOT NULL,
  nominal NUMERIC(15,2) NOT NULL DEFAULT 0,
  catatan TEXT,
  dibagikan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tahun)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pinjaman_updated BEFORE UPDATE ON public.pinjaman
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- new user trigger: profile + default role + nomor_anggota
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_count INT;
  v_nomor TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.profiles WHERE nomor_anggota LIKE 'TCOOL-' || v_year || '-%';
  v_nomor := 'TCOOL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, nomor_anggota)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'no_hp',
    v_nomor
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'anggota');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simpanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.angsuran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shu ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "view own or pengurus" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_pengurus(auth.uid()));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "pengurus update any profile" ON public.profiles FOR UPDATE TO authenticated
USING (public.is_pengurus(auth.uid()));

-- user_roles policies
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "super_admin manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- simpanan policies
CREATE POLICY "view own simpanan or pengurus" ON public.simpanan FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "insert own simpanan" ON public.simpanan FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pengurus update simpanan" ON public.simpanan FOR UPDATE TO authenticated
USING (public.is_pengurus(auth.uid()));

-- pinjaman policies
CREATE POLICY "view own pinjaman or pengurus" ON public.pinjaman FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "insert own pinjaman" ON public.pinjaman FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own draft pinjaman" ON public.pinjaman FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'draft') WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pengurus update pinjaman" ON public.pinjaman FOR UPDATE TO authenticated
USING (public.is_pengurus(auth.uid()));

-- angsuran policies
CREATE POLICY "view own angsuran or pengurus" ON public.angsuran FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "insert own angsuran" ON public.angsuran FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pengurus update angsuran" ON public.angsuran FOR UPDATE TO authenticated
USING (public.is_pengurus(auth.uid()));

-- shu policies
CREATE POLICY "view own shu or pengurus" ON public.shu FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "pengurus manage shu" ON public.shu FOR ALL TO authenticated
USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));
