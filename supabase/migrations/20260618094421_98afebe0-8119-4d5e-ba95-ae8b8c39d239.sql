CREATE TABLE public.security_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  description text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_logs_created_at ON public.security_logs (created_at DESC);
CREATE INDEX idx_security_logs_user_id ON public.security_logs (user_id);
CREATE INDEX idx_security_logs_event_type ON public.security_logs (event_type);

GRANT SELECT, INSERT ON public.security_logs TO authenticated;
GRANT ALL ON public.security_logs TO service_role;

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Hanya super admin yang boleh membaca log keamanan
CREATE POLICY "Super admin can view security logs"
ON public.security_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Pengguna login boleh menyisipkan log (selalu untuk dirinya / sistem)
CREATE POLICY "Authenticated can insert security logs"
ON public.security_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fungsi pencatat aktivitas keamanan (aman dipanggil dari klien)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _description text DEFAULT NULL,
  _ip_address text DEFAULT NULL,
  _user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.security_logs (user_id, event_type, description, ip_address)
  VALUES (COALESCE(_user_id, auth.uid()), _event_type, _description, _ip_address)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Trigger otomatis: catat perubahan role
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_name text;
BEGIN
  SELECT nama_lengkap INTO v_target_name FROM public.profiles WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_logs (user_id, event_type, description)
    VALUES (auth.uid(), 'role_change',
      'Role "' || NEW.role::text || '" ditambahkan untuk ' || COALESCE(v_target_name, NEW.user_id::text));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      INSERT INTO public.security_logs (user_id, event_type, description)
      VALUES (auth.uid(), 'role_change',
        CASE WHEN NEW.deleted_at IS NOT NULL
          THEN 'Role "' || NEW.role::text || '" dicabut dari ' || COALESCE(v_target_name, NEW.user_id::text)
          ELSE 'Role "' || NEW.role::text || '" diaktifkan kembali untuk ' || COALESCE(v_target_name, NEW.user_id::text)
        END);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_logs (user_id, event_type, description)
    VALUES (auth.uid(), 'role_change',
      'Role "' || OLD.role::text || '" dihapus dari ' || COALESCE(v_target_name, OLD.user_id::text));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_change ON public.user_roles;
CREATE TRIGGER trg_log_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();