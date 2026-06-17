-- ============ 1. Tabel activity_logs ============
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  description text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);

-- ============ 2. GRANTS ============
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

-- ============ 3. RLS ============
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Hanya pimpinan (ketua / super_admin) yang boleh melihat seluruh log
CREATE POLICY "Leaders can view activity logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ketua') OR public.has_role(auth.uid(), 'super_admin')
);

-- User boleh menulis log atas namanya sendiri (login/logout dsb)
CREATE POLICY "Users can insert own activity"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============ 4. RPC log_activity (untuk login/logout dari client) ============
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _module text,
  _description text DEFAULT NULL,
  _ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.activity_logs (user_id, action, module, description, ip_address)
  VALUES (auth.uid(), _action, _module, _description, _ip_address);
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, text) TO authenticated;

-- ============ 5. Trigger generik pencatatan otomatis ============
CREATE OR REPLACE FUNCTION public.fn_activity_autolog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_module text;
  v_desc text;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    v_module := 'anggota';
    IF TG_OP = 'INSERT' THEN
      v_action := 'tambah_anggota';
      v_desc := 'Anggota baru: ' || COALESCE(NEW.nama_lengkap, NEW.id::text);
    ELSIF TG_OP = 'UPDATE' THEN
      v_action := 'edit_anggota';
      v_desc := 'Ubah data anggota: ' || COALESCE(NEW.nama_lengkap, NEW.id::text);
    ELSE
      v_action := 'hapus_data';
      v_desc := 'Hapus anggota: ' || COALESCE(OLD.nama_lengkap, OLD.id::text);
    END IF;

  ELSIF TG_TABLE_NAME = 'simpanan' THEN
    v_module := 'simpanan';
    IF TG_OP = 'INSERT' THEN
      v_action := 'transaksi_simpanan';
      v_desc := 'Simpanan ' || COALESCE(NEW.jenis,'-') || ' Rp ' || COALESCE(NEW.nominal::text,'0');
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'hapus_data';
      v_desc := 'Hapus simpanan Rp ' || COALESCE(OLD.nominal::text,'0');
    ELSE
      v_action := 'transaksi_simpanan';
      v_desc := 'Ubah simpanan menjadi status ' || COALESCE(NEW.status,'-');
    END IF;

  ELSIF TG_TABLE_NAME = 'pinjaman' THEN
    v_module := 'pinjaman';
    IF TG_OP = 'INSERT' THEN
      v_action := 'transaksi_pinjaman';
      v_desc := 'Pengajuan pinjaman Rp ' || COALESCE(NEW.nominal::text,'0');
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'hapus_data';
      v_desc := 'Hapus pinjaman Rp ' || COALESCE(OLD.nominal::text,'0');
    ELSE
      v_action := 'transaksi_pinjaman';
      v_desc := 'Ubah pinjaman menjadi status ' || COALESCE(NEW.status,'-');
    END IF;

  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    v_module := 'permission';
    IF TG_OP = 'INSERT' THEN
      v_action := 'perubahan_permission';
      v_desc := 'Tambah role ' || NEW.role::text;
    ELSE
      v_action := 'perubahan_permission';
      v_desc := 'Cabut role ' || OLD.role::text;
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.activity_logs (user_id, action, module, description)
  VALUES (auth.uid(), v_action, v_module, v_desc);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Pasang trigger
DROP TRIGGER IF EXISTS trg_activity_profiles ON public.profiles;
CREATE TRIGGER trg_activity_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_activity_autolog();

DROP TRIGGER IF EXISTS trg_activity_simpanan ON public.simpanan;
CREATE TRIGGER trg_activity_simpanan
AFTER INSERT OR UPDATE OR DELETE ON public.simpanan
FOR EACH ROW EXECUTE FUNCTION public.fn_activity_autolog();

DROP TRIGGER IF EXISTS trg_activity_pinjaman ON public.pinjaman;
CREATE TRIGGER trg_activity_pinjaman
AFTER INSERT OR UPDATE OR DELETE ON public.pinjaman
FOR EACH ROW EXECUTE FUNCTION public.fn_activity_autolog();

DROP TRIGGER IF EXISTS trg_activity_user_roles ON public.user_roles;
CREATE TRIGGER trg_activity_user_roles
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.fn_activity_autolog();