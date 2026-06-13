
CREATE OR REPLACE FUNCTION public.is_leader(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'ketua') OR public.has_role(_uid, 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_finance(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'bendahara') OR public.has_role(_uid, 'ketua') OR public.has_role(_uid, 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_secretary(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'sekretaris') OR public.has_role(_uid, 'ketua') OR public.has_role(_uid, 'super_admin');
$$;

-- Settings: kelola oleh pimpinan (ketua + super_admin)
DROP POLICY IF EXISTS "settings super admin manage" ON public.settings;
CREATE POLICY "settings leader manage" ON public.settings FOR ALL TO authenticated
  USING (public.is_leader(auth.uid())) WITH CHECK (public.is_leader(auth.uid()));

-- Permissions: kelola oleh pimpinan
DROP POLICY IF EXISTS "permissions super admin manage" ON public.permissions;
CREATE POLICY "permissions leader manage" ON public.permissions FOR ALL TO authenticated
  USING (public.is_leader(auth.uid())) WITH CHECK (public.is_leader(auth.uid()));

-- Role-permissions: kelola oleh pimpinan
DROP POLICY IF EXISTS "role_permissions super admin manage" ON public.role_permissions;
CREATE POLICY "role_permissions leader manage" ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_leader(auth.uid())) WITH CHECK (public.is_leader(auth.uid()));
