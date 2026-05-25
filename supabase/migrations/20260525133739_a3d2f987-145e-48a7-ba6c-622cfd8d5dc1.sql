CREATE TABLE public.church_requesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  jabatan text NOT NULL,
  division_id uuid REFERENCES public.church_divisions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  appointed_by uuid,
  appointed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.church_requesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or pengurus" ON public.church_requesters
FOR SELECT USING (user_id = auth.uid() OR public.is_pengurus(auth.uid()));

CREATE POLICY "pengurus manage" ON public.church_requesters
FOR ALL USING (public.is_pengurus(auth.uid())) WITH CHECK (public.is_pengurus(auth.uid()));

CREATE TRIGGER trg_church_requesters_updated
BEFORE UPDATE ON public.church_requesters
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_church_requester(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.church_requesters WHERE user_id = _uid AND is_active = true);
$$;

DROP POLICY IF EXISTS "pr insert own" ON public.church_purchase_requests;
CREATE POLICY "pr insert authorized" ON public.church_purchase_requests
FOR INSERT WITH CHECK (
  requester_id = auth.uid()
  AND (public.is_church_requester(auth.uid()) OR public.is_pengurus(auth.uid()))
);