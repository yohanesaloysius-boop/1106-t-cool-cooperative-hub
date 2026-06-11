-- Login by phone perlu memanggil get_email_by_phone sebelum sesi terbentuk.
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;

-- ============ audit_logs ============
DROP POLICY IF EXISTS "audit insert any auth" ON public.audit_logs;
CREATE POLICY "audit insert self only" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ church_vendors / school_vendors ============
DROP POLICY IF EXISTS "vendor read auth" ON public.church_vendors;
CREATE POLICY "vendor read pengurus" ON public.church_vendors
  FOR SELECT TO authenticated USING (public.is_pengurus(auth.uid()));

DROP POLICY IF EXISTS "svendor read auth" ON public.school_vendors;
CREATE POLICY "svendor read pengurus" ON public.school_vendors
  FOR SELECT TO authenticated USING (public.is_pengurus(auth.uid()));

-- ============ church_divisions / school_divisions ============
DROP POLICY IF EXISTS "div read auth" ON public.church_divisions;
CREATE POLICY "div read pengurus" ON public.church_divisions
  FOR SELECT TO authenticated USING (public.is_pengurus(auth.uid()));

DROP POLICY IF EXISTS "sdiv read auth" ON public.school_divisions;
CREATE POLICY "sdiv read pengurus" ON public.school_divisions
  FOR SELECT TO authenticated USING (public.is_pengurus(auth.uid()));

-- ============ reserve_funds & opex_categories ============
DROP POLICY IF EXISTS "rf read auth" ON public.reserve_funds;
DROP POLICY IF EXISTS "opex_cat read auth" ON public.opex_categories;
-- 'rf pengurus all' & 'opex_cat pengurus all' tetap melayani pengurus.

-- ============ meeting_attendances ============
DROP POLICY IF EXISTS "att view all auth" ON public.meeting_attendances;
CREATE POLICY "att view own or pengurus" ON public.meeting_attendances
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_pengurus(auth.uid()));

-- ============ meeting_notes ============
DROP POLICY IF EXISTS "mnotes read all auth" ON public.meeting_notes;
CREATE POLICY "mnotes read pengurus or attended" ON public.meeting_notes
  FOR SELECT TO authenticated
  USING (
    public.is_pengurus(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_attendances ma
      WHERE ma.meeting_id = meeting_notes.meeting_id AND ma.user_id = auth.uid()
    )
  );

-- ============ permissions / role_permissions ============
DROP POLICY IF EXISTS "permissions read all auth" ON public.permissions;
DROP POLICY IF EXISTS "role_permissions read all auth" ON public.role_permissions;
CREATE POLICY "permissions read pengurus" ON public.permissions
  FOR SELECT TO authenticated USING (public.is_pengurus(auth.uid()));
CREATE POLICY "role_permissions read pengurus" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_pengurus(auth.uid()));

-- ============ marketplace_coupons ============
DROP POLICY IF EXISTS "coupons public read active" ON public.marketplace_coupons;
CREATE POLICY "coupons auth read active" ON public.marketplace_coupons
  FOR SELECT TO authenticated USING (is_active = true);

-- ============ lowongan_kerja ============
-- Cabut akses publik tabel; sediakan RPC aman untuk landing page.
DROP POLICY IF EXISTS "Approved lowongan public read" ON public.lowongan_kerja;

CREATE OR REPLACE FUNCTION public.get_public_lowongan(_limit integer DEFAULT 12)
RETURNS TABLE (
  id uuid,
  judul text,
  perusahaan text,
  posisi text,
  lokasi text,
  gender text,
  deskripsi text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.judul, l.perusahaan, l.posisi, l.lokasi,
         l.gender::text, l.deskripsi, l.created_at
  FROM public.lowongan_kerja l
  WHERE l.status = 'approved'
    AND (l.expired_at IS NULL OR l.expired_at > now())
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_lowongan(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_lowongan(integer) TO anon, authenticated;

-- Anggota login tetap melihat lowongan approved (untuk halaman /lowongan).
CREATE POLICY "lowongan read approved auth" ON public.lowongan_kerja
  FOR SELECT TO authenticated
  USING (status = 'approved' OR created_by = auth.uid() OR public.is_pengurus(auth.uid()));
