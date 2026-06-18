-- Tighten audit insert policies so users can only insert audit rows
-- as themselves and only for purchase requests they are involved in.

DROP POLICY IF EXISTS "audit insert auth" ON public.church_pr_audit;
CREATE POLICY "audit insert auth" ON public.church_pr_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.church_purchase_requests p
      WHERE p.id = pr_id
        AND (p.requester_id = auth.uid() OR public.is_pengurus(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "saudit insert auth" ON public.school_pr_audit;
CREATE POLICY "saudit insert auth" ON public.school_pr_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.school_purchase_requests p
      WHERE p.id = pr_id
        AND (p.requester_id = auth.uid() OR public.is_pengurus(auth.uid()))
    )
  );