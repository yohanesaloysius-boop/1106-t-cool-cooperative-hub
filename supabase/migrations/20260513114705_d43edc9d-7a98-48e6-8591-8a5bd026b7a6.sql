
-- =========================================================
-- T-COOL KOPERASI — Full schema extension
-- =========================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.transaksi_jenis AS ENUM (
    'simpanan_masuk','simpanan_keluar','pinjaman_cair','angsuran_masuk',
    'shu_keluar','biaya_admin','pendapatan_bunga','lainnya'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_target AS ENUM ('pinjaman','simpanan','anggota','pengumuman','lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notif_kategori AS ENUM ('info','sukses','peringatan','error','approval','transaksi','sistem');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_status AS ENUM ('active','inactive','expired','blocked','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('scheduled','ongoing','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- AUDIT/SOFT DELETE on existing tables ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_card_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS card_status public.card_status NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS card_expired_at DATE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.simpanan
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.pinjaman
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.angsuran
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.shu
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_simpanan_updated ON public.simpanan;
CREATE TRIGGER trg_simpanan_updated BEFORE UPDATE ON public.simpanan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_angsuran_updated ON public.angsuran;
CREATE TRIGGER trg_angsuran_updated BEFORE UPDATE ON public.angsuran
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_shu_updated ON public.shu;
CREATE TRIGGER trg_shu_updated BEFORE UPDATE ON public.shu
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pinjaman_updated ON public.pinjaman;
CREATE TRIGGER trg_pinjaman_updated BEFORE UPDATE ON public.pinjaman
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- PERMISSIONS ----------
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission_id)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions read all auth" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions super admin manage" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "role_permissions read all auth" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions super admin manage" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- ---------- TRANSAKSI (general ledger) ----------
CREATE TABLE IF NOT EXISTS public.transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE,
  user_id UUID,
  jenis public.transaksi_jenis NOT NULL,
  nominal NUMERIC(18,2) NOT NULL CHECK (nominal >= 0),
  arah TEXT NOT NULL CHECK (arah IN ('debit','kredit')),
  ref_table TEXT,
  ref_id UUID,
  keterangan TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transaksi_user ON public.transaksi(user_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_tgl ON public.transaksi(tanggal);
ALTER TABLE public.transaksi ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_transaksi_updated ON public.transaksi;
CREATE TRIGGER trg_transaksi_updated BEFORE UPDATE ON public.transaksi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "transaksi view own or pengurus" ON public.transaksi FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.is_pengurus(auth.uid()));
CREATE POLICY "transaksi pengurus insert" ON public.transaksi FOR INSERT TO authenticated
  WITH CHECK (public.is_pengurus(auth.uid()));
CREATE POLICY "transaksi pengurus update" ON public.transaksi FOR UPDATE TO authenticated
  USING (public.is_pengurus(auth.uid()));

-- ---------- APPROVALS ----------
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.approval_target NOT NULL,
  target_id UUID NOT NULL,
  required_role public.app_role NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  step_order INT NOT NULL DEFAULT 1,
  approver_id UUID,
  catatan TEXT,
  acted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approvals_target ON public.approvals(target_type, target_id);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_approvals_updated ON public.approvals;
CREATE TRIGGER trg_approvals_updated BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "approvals pengurus all" ON public.approvals FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));
CREATE POLICY "approvals view own related" ON public.approvals FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR approver_id = auth.uid());

-- ---------- APPROVAL HISTORIES ----------
CREATE TABLE IF NOT EXISTS public.approval_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  actor_role public.app_role,
  action public.approval_status NOT NULL,
  catatan TEXT,
  signature_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apphist_app ON public.approval_histories(approval_id);
ALTER TABLE public.approval_histories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apphist pengurus all" ON public.approval_histories FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));
CREATE POLICY "apphist view own actor" ON public.approval_histories FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- ---------- SIGNATURES ----------
CREATE TABLE IF NOT EXISTS public.signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  signature_url TEXT NOT NULL,
  hash TEXT,
  ref_table TEXT,
  ref_id UUID,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signatures_user ON public.signatures(user_id);
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures view own or pengurus" ON public.signatures FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "signatures insert own" ON public.signatures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------- NOTIFICATIONS ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  judul TEXT NOT NULL,
  pesan TEXT NOT NULL,
  kategori public.notif_kategori NOT NULL DEFAULT 'info',
  url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  ref_table TEXT,
  ref_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, is_read);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif view own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif pengurus insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_pengurus(auth.uid()) OR auth.uid() = user_id);

-- ---------- SETTINGS ----------
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_settings_updated ON public.settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "settings public read" ON public.settings FOR SELECT TO authenticated
  USING (is_public OR public.is_pengurus(auth.uid()));
CREATE POLICY "settings super admin manage" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- ---------- PENGUMUMAN ----------
CREATE TABLE IF NOT EXISTS public.pengumuman (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pengumuman ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_pengumuman_updated ON public.pengumuman;
CREATE TRIGGER trg_pengumuman_updated BEFORE UPDATE ON public.pengumuman FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "pengumuman read published" ON public.pengumuman FOR SELECT TO authenticated
  USING (is_published OR public.is_pengurus(auth.uid()));
CREATE POLICY "pengumuman pengurus manage" ON public.pengumuman FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));

-- ---------- MEETINGS ----------
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  agenda TEXT,
  lokasi TEXT,
  link_online TEXT,
  mulai TIMESTAMPTZ NOT NULL,
  selesai TIMESTAMPTZ,
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_meetings_updated ON public.meetings;
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "meetings read all auth" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings pengurus manage" ON public.meetings FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));

-- ---------- MEETING NOTES ----------
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  isi TEXT NOT NULL,
  keputusan TEXT,
  notulis_id UUID,
  attachment_url TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_mnotes_updated ON public.meeting_notes;
CREATE TRIGGER trg_mnotes_updated BEFORE UPDATE ON public.meeting_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "mnotes read all auth" ON public.meeting_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "mnotes pengurus manage" ON public.meeting_notes FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));

-- ---------- DOCUMENTS ----------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nama TEXT NOT NULL,
  kategori TEXT,
  file_url TEXT NOT NULL,
  mime TEXT,
  ukuran BIGINT,
  ref_table TEXT,
  ref_id UUID,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_user ON public.documents(user_id);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_docs_updated ON public.documents;
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "docs view own/public/pengurus" ON public.documents FOR SELECT TO authenticated
  USING (is_public OR auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "docs insert own" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "docs update own/pengurus" ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));

-- ---------- AUDIT LOGS ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_role public.app_role,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit pengurus read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_pengurus(auth.uid()));
CREATE POLICY "audit insert any auth" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_pengurus(auth.uid()));

-- ---------- MEMBER CARDS (history) ----------
CREATE TABLE IF NOT EXISTS public.member_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_number TEXT NOT NULL UNIQUE,
  qr_code TEXT,
  barcode TEXT,
  status public.card_status NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expired_at DATE,
  catatan TEXT,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcards_user ON public.member_cards(user_id);
ALTER TABLE public.member_cards ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_mcards_updated ON public.member_cards;
CREATE TRIGGER trg_mcards_updated BEFORE UPDATE ON public.member_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "mcards view own or pengurus" ON public.member_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));
CREATE POLICY "mcards pengurus manage" ON public.member_cards FOR ALL TO authenticated
  USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));

-- ---------- SEED: PERMISSIONS ----------
INSERT INTO public.permissions (code, description) VALUES
  ('anggota.view','Lihat data anggota'),
  ('anggota.manage','Kelola data anggota'),
  ('simpanan.view','Lihat simpanan'),
  ('simpanan.verify','Verifikasi simpanan'),
  ('pinjaman.view','Lihat pinjaman'),
  ('pinjaman.approve','Setujui pinjaman'),
  ('pinjaman.disburse','Cairkan pinjaman'),
  ('angsuran.verify','Verifikasi angsuran'),
  ('shu.manage','Kelola SHU'),
  ('laporan.view','Lihat laporan keuangan'),
  ('settings.manage','Kelola pengaturan'),
  ('pengumuman.manage','Kelola pengumuman'),
  ('meeting.manage','Kelola rapat'),
  ('audit.view','Lihat audit log'),
  ('roles.manage','Kelola roles & permissions')
ON CONFLICT (code) DO NOTHING;

-- ---------- SEED: ROLE PERMISSIONS ----------
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin'::public.app_role, id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'ketua'::public.app_role, id FROM public.permissions
WHERE code IN ('anggota.view','anggota.manage','pinjaman.view','pinjaman.approve','laporan.view','shu.manage','pengumuman.manage','meeting.manage','audit.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'sekretaris'::public.app_role, id FROM public.permissions
WHERE code IN ('anggota.view','anggota.manage','pinjaman.view','pinjaman.approve','pengumuman.manage','meeting.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'bendahara'::public.app_role, id FROM public.permissions
WHERE code IN ('simpanan.view','simpanan.verify','pinjaman.view','pinjaman.approve','pinjaman.disburse','angsuran.verify','laporan.view','shu.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'anggota'::public.app_role, id FROM public.permissions
WHERE code IN ('simpanan.view','pinjaman.view')
ON CONFLICT DO NOTHING;

-- ---------- SEED: SETTINGS ----------
INSERT INTO public.settings (key, value, description, is_public) VALUES
  ('koperasi.profile', '{"nama":"T-COOL Koperasi","alamat":"-","telepon":"-","email":"info@tcool.id"}'::jsonb, 'Profil koperasi', true),
  ('simpanan.pokok', '{"nominal":250000}'::jsonb, 'Nominal simpanan pokok', true),
  ('simpanan.wajib', '{"nominal":50000}'::jsonb, 'Nominal simpanan wajib bulanan', true),
  ('pinjaman.bunga_default', '{"jenis":"flat","persen":1.5}'::jsonb, 'Bunga pinjaman default', true),
  ('pinjaman.tenor_max', '{"bulan":36}'::jsonb, 'Tenor pinjaman maksimum', true),
  ('shu.formula', '{"jasa_modal":40,"jasa_usaha":40,"cadangan":10,"pengurus":10}'::jsonb, 'Formula pembagian SHU (%)', false),
  ('card.expiry_years', '{"tahun":3}'::jsonb, 'Masa berlaku kartu anggota (tahun)', false)
ON CONFLICT (key) DO NOTHING;
