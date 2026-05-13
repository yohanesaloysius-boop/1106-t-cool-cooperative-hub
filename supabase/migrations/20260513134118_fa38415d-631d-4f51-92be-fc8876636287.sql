-- Meeting attendances + signatures linkage
CREATE TABLE IF NOT EXISTS public.meeting_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited', -- invited | confirmed | declined | attended
  signed_at TIMESTAMPTZ,
  signature_id UUID,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

ALTER TABLE public.meeting_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att view all auth" ON public.meeting_attendances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "att upsert own or pengurus" ON public.meeting_attendances
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_pengurus(auth.uid()));

CREATE POLICY "att update own or pengurus" ON public.meeting_attendances
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));

CREATE POLICY "att delete pengurus" ON public.meeting_attendances
  FOR DELETE TO authenticated USING (public.is_pengurus(auth.uid()));

CREATE TRIGGER meeting_attendances_updated_at BEFORE UPDATE ON public.meeting_attendances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_meeting_attendances_meeting ON public.meeting_attendances(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendances_user ON public.meeting_attendances(user_id);

-- Add approval status to meeting_notes for ketua review
ALTER TABLE public.meeting_notes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'; -- draft | pending | approved | rejected
ALTER TABLE public.meeting_notes ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.meeting_notes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.meeting_notes ADD COLUMN IF NOT EXISTS signature_id UUID;

ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendances;