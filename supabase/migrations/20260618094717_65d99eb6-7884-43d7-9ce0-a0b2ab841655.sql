-- Perubahan izin (role_permissions)
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_logs (user_id, event_type, description)
    VALUES (auth.uid(), 'permission_change', 'Izin ditambahkan: ' || COALESCE(NEW.role::text,'') || ' → ' || COALESCE(NEW.permission_id::text, NEW::text));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_logs (user_id, event_type, description)
    VALUES (auth.uid(), 'permission_change', 'Izin dihapus: ' || COALESCE(OLD.role::text,'') || ' → ' || COALESCE(OLD.permission_id::text, OLD::text));
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_log_permission_change ON public.role_permissions;
CREATE TRIGGER trg_log_permission_change
AFTER INSERT OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

-- Edit transaksi
CREATE OR REPLACE FUNCTION public.log_transaction_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, event_type, description)
  VALUES (auth.uid(), 'transaction_edit',
    'Transaksi diubah (id ' || substr(NEW.id::text,1,8) || ', jenis ' || COALESCE(NEW.jenis,'-') || ', nominal ' || COALESCE(NEW.nominal::text,'-') || ')');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_transaction_edit ON public.transaksi;
CREATE TRIGGER trg_log_transaction_edit
AFTER UPDATE ON public.transaksi
FOR EACH ROW EXECUTE FUNCTION public.log_transaction_edit();

-- Hapus data sensitif (generic)
CREATE OR REPLACE FUNCTION public.log_sensitive_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, event_type, description)
  VALUES (auth.uid(), 'data_delete',
    'Hapus data pada tabel "' || TG_TABLE_NAME || '" (id ' || substr(OLD.id::text,1,8) || ')');
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_log_delete_transaksi ON public.transaksi;
CREATE TRIGGER trg_log_delete_transaksi AFTER DELETE ON public.transaksi
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_delete();

DROP TRIGGER IF EXISTS trg_log_delete_simpanan ON public.simpanan;
CREATE TRIGGER trg_log_delete_simpanan AFTER DELETE ON public.simpanan
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_delete();

DROP TRIGGER IF EXISTS trg_log_delete_pinjaman ON public.pinjaman;
CREATE TRIGGER trg_log_delete_pinjaman AFTER DELETE ON public.pinjaman
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_delete();

DROP TRIGGER IF EXISTS trg_log_delete_profiles ON public.profiles;
CREATE TRIGGER trg_log_delete_profiles AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_delete();