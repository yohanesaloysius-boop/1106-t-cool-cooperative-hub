-- 1) Auto-insert transaksi + notif saat tabungan_berjangka diaktifkan
CREATE OR REPLACE FUNCTION public.tabjangka_on_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    INSERT INTO public.transaksi (user_id, jenis, arah, nominal, ref_table, ref_id, keterangan)
    VALUES (
      NEW.user_id, 'tabungan_setor', 'kredit', NEW.nominal,
      'tabungan_berjangka', NEW.id,
      'Setoran deposito ' || NEW.tenor_bulan || ' bulan'
    );

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'Tabungan Berjangka Diaktifkan',
      'Deposito Anda sebesar ' ||
        to_char(NEW.nominal, 'FM999G999G999G999') ||
        ' (' || NEW.tenor_bulan || ' bulan, bunga ' || NEW.bunga_persen || '%) telah aktif. Jatuh tempo: ' ||
        COALESCE(to_char(NEW.tanggal_jatuh_tempo, 'DD Mon YYYY'), '-'),
      'sukses', '/tabungan-berjangka', 'tabungan_berjangka', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tabjangka_on_active ON public.tabungan_berjangka;
CREATE TRIGGER trg_tabjangka_on_active
AFTER UPDATE OF status ON public.tabungan_berjangka
FOR EACH ROW
EXECUTE FUNCTION public.tabjangka_on_active();

-- 2) Maturity processor: dipanggil tiap hari via pg_cron
CREATE OR REPLACE FUNCTION public.mature_tabungan_berjangka()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  bagi_hasil numeric;
  total_kembali numeric;
  cnt int := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, nominal, tenor_bulan, bunga_persen
    FROM public.tabungan_berjangka
    WHERE status = 'active'
      AND tanggal_jatuh_tempo IS NOT NULL
      AND tanggal_jatuh_tempo <= CURRENT_DATE
      AND deleted_at IS NULL
  LOOP
    -- Bagi hasil flat: nominal * (bunga% / 100) * (tenor/12)
    bagi_hasil := ROUND(r.nominal * (r.bunga_persen / 100.0) * (r.tenor_bulan / 12.0));
    total_kembali := r.nominal + bagi_hasil;

    UPDATE public.tabungan_berjangka
    SET status = 'matured',
        total_bagi_hasil = bagi_hasil,
        updated_at = now()
    WHERE id = r.id;

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      r.user_id,
      'Tabungan Berjangka Jatuh Tempo',
      'Deposito Anda telah jatuh tempo. Pokok: Rp ' ||
        to_char(r.nominal, 'FM999G999G999G999') ||
        ', bagi hasil: Rp ' || to_char(bagi_hasil, 'FM999G999G999G999') ||
        '. Total dapat ditarik: Rp ' || to_char(total_kembali, 'FM999G999G999G999'),
      'sukses', '/tabungan-berjangka', 'tabungan_berjangka', r.id
    );

    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mature_tabungan_berjangka() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mature_tabungan_berjangka() TO service_role;

-- 3) Schedule via pg_cron — setiap hari jam 02:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mature-tabungan-berjangka-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mature-tabungan-berjangka-daily');

    PERFORM cron.schedule(
      'mature-tabungan-berjangka-daily',
      '0 2 * * *',
      $cron$SELECT public.mature_tabungan_berjangka();$cron$
    );
  END IF;
END;
$$;