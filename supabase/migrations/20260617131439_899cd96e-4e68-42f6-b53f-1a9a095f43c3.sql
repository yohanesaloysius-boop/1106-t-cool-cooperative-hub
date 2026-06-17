CREATE OR REPLACE FUNCTION public.notify_backup_reminder()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date_key text := to_char(now(), 'YYYY-MM-DD');
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
  SELECT DISTINCT ur.user_id,
    '🗄️ Pengingat Backup Harian',
    'Jangan lupa backup data koperasi hari ini. Buka menu Backup untuk mengunduh snapshot (ZIP/Excel/JSON) dan simpan ke penyimpanan eksternal.',
    'sistem'::notif_kategori,
    '/admin/backup',
    'backup:reminder',
    v_date_key
  FROM public.user_roles ur
  WHERE ur.role = 'super_admin'
    AND ur.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = ur.user_id
        AND n.ref_table = 'backup:reminder'
        AND n.ref_id = v_date_key
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_backup_reminder() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_backup_reminder() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('backup-reminder-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backup-reminder-daily');

    PERFORM cron.schedule(
      'backup-reminder-daily',
      '0 1 * * *',
      $cron$SELECT public.notify_backup_reminder();$cron$
    );
  END IF;
END;
$$;