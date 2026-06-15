-- Approval histories: allow the originator of the parent approval to view the trail
CREATE POLICY "apphist view own requester"
ON public.approval_histories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.approvals a
    WHERE a.id = approval_histories.approval_id
      AND a.created_by = auth.uid()
  )
);

-- School divisions: authorized school requesters can read active divisions
CREATE POLICY "sdiv read requester"
ON public.school_divisions
FOR SELECT
TO authenticated
USING (public.is_school_requester(auth.uid()) AND is_active = true);

-- Church divisions: authorized church requesters can read active divisions
CREATE POLICY "div read requester"
ON public.church_divisions
FOR SELECT
TO authenticated
USING (public.is_church_requester(auth.uid()) AND is_active = true);