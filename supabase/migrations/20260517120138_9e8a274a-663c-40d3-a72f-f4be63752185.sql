
-- Trigger: notify pengurus on new simpanan
CREATE OR REPLACE FUNCTION public.notify_pengurus_new_simpanan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nama text;
  v_jenis text;
BEGIN
  SELECT nama_lengkap INTO v_nama FROM public.profiles WHERE id = NEW.user_id;
  v_jenis := NEW.jenis::text;
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  SELECT
    ur.user_id,
    '💰 Setoran simpanan baru',
    'Anggota ' || COALESCE(v_nama, '(tanpa nama)') || ' menyetor simpanan ' || v_jenis ||
      ' sebesar Rp ' || to_char(NEW.nominal, 'FM999G999G999') || '. Menunggu verifikasi.',
    'approval'::notif_kategori,
    '/admin/simpanan',
    'simpanan',
    NEW.id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin','ketua','sekretaris','bendahara')
    AND ur.deleted_at IS NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_pengurus_new_simpanan ON public.simpanan;
CREATE TRIGGER trg_notify_pengurus_new_simpanan
AFTER INSERT ON public.simpanan
FOR EACH ROW EXECUTE FUNCTION public.notify_pengurus_new_simpanan();

-- Trigger: notify pengurus on new pinjaman (status != draft)
CREATE OR REPLACE FUNCTION public.notify_pengurus_new_pinjaman()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nama text;
BEGIN
  -- Notify on creation if not draft, OR when status transitions from draft to anything else
  IF (TG_OP = 'INSERT' AND NEW.status::text <> 'draft')
     OR (TG_OP = 'UPDATE' AND OLD.status::text = 'draft' AND NEW.status::text <> 'draft') THEN
    SELECT nama_lengkap INTO v_nama FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    SELECT
      ur.user_id,
      '📝 Pengajuan pinjaman baru',
      'Anggota ' || COALESCE(v_nama, '(tanpa nama)') || ' mengajukan pinjaman Rp ' ||
        to_char(NEW.nominal, 'FM999G999G999') || ' (tenor ' || NEW.tenor_bulan || ' bulan). Mohon ditinjau.',
      'approval'::notif_kategori,
      '/admin/pinjaman',
      'pinjaman',
      NEW.id
    FROM public.user_roles ur
    WHERE ur.role IN ('super_admin','ketua','sekretaris','bendahara')
      AND ur.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_pengurus_new_pinjaman_ins ON public.pinjaman;
CREATE TRIGGER trg_notify_pengurus_new_pinjaman_ins
AFTER INSERT ON public.pinjaman
FOR EACH ROW EXECUTE FUNCTION public.notify_pengurus_new_pinjaman();

DROP TRIGGER IF EXISTS trg_notify_pengurus_new_pinjaman_upd ON public.pinjaman;
CREATE TRIGGER trg_notify_pengurus_new_pinjaman_upd
AFTER UPDATE OF status ON public.pinjaman
FOR EACH ROW EXECUTE FUNCTION public.notify_pengurus_new_pinjaman();

-- Aktifkan realtime untuk notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
