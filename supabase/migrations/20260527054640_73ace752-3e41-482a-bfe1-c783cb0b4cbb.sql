CREATE TABLE public.school_requesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  jabatan text NOT NULL,
  unit_kerja text,
  is_active boolean NOT NULL DEFAULT true,
  appointed_by uuid,
  appointed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_requesters TO authenticated;
GRANT ALL ON public.school_requesters TO service_role;

ALTER TABLE public.school_requesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or pengurus" ON public.school_requesters
  FOR SELECT USING ((user_id = auth.uid()) OR is_pengurus(auth.uid()));

CREATE POLICY "pengurus manage" ON public.school_requesters
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE TRIGGER trg_school_requesters_updated
  BEFORE UPDATE ON public.school_requesters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();