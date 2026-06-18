DROP POLICY IF EXISTS "super_admin manage roles" ON public.user_roles;
CREATE POLICY "pimpinan manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_leader(auth.uid()))
  WITH CHECK (public.is_leader(auth.uid()));