CREATE OR REPLACE FUNCTION public.notify_backup_reminder()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table)
  SELECT DISTINCT ur.user_id,
    '🗄️ Pengingat Backup Harian',
    'Jangan lupa backup data koperasi hari ini. Buka menu Backup untuk mengunduh snapshot (ZIP/Excel/JSON) dan simpan ke penyimpanan eksternal.',
    'sistem'::notif_kategori,
    '/admin/backup',
    'backup:reminder'
  FROM public.user_roles ur
  WHERE ur.role = 'super_admin'
    AND ur.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = ur.user_id
        AND n.ref_table = 'backup:reminder'
        AND n.created_at >= date_trunc('day', now())
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_backup_reminder() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_backup_reminder() TO service_role;