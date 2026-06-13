CREATE OR REPLACE FUNCTION public.normalize_simpanan_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'approved' THEN
    NEW.status := 'verified'::public.payment_status;
    NEW.verified_at := COALESCE(NEW.verified_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_simpanan_status ON public.simpanan;
CREATE TRIGGER trg_normalize_simpanan_status
BEFORE INSERT OR UPDATE OF status ON public.simpanan
FOR EACH ROW EXECUTE FUNCTION public.normalize_simpanan_status();

CREATE OR REPLACE FUNCTION public.auto_debet_simpanan_wajib(_periode date DEFAULT NULL::date)
RETURNS TABLE(total_anggota integer, berhasil integer, gagal integer, total_terdebit numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periode date := COALESCE(_periode, date_trunc('month', current_date)::date);
  v_nominal numeric;
  v_setting jsonb;
  v_total integer := 0;
  v_ok integer := 0;
  v_fail integer := 0;
  v_sum numeric := 0;
  r record;
  v_wallet_saldo numeric;
  v_simpanan_id uuid;
BEGIN
  SELECT value INTO v_setting FROM public.settings WHERE key = 'iuran_wajib_default';
  v_nominal := COALESCE((v_setting->>'nominal')::numeric, 50000);

  FOR r IN
    SELECT p.id AS user_id, p.nama_lengkap
    FROM public.profiles p
    WHERE p.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.simpanan s
        WHERE s.user_id = p.id
          AND s.jenis = 'wajib'
          AND date_trunc('month', s.created_at) = v_periode
          AND s.status::text IN ('pending', 'verified', 'approved')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.pending_iuran pi
        WHERE pi.user_id = p.id AND pi.periode = v_periode AND pi.jenis = 'wajib'
      )
  LOOP
    v_total := v_total + 1;
    SELECT saldo INTO v_wallet_saldo FROM public.wallets WHERE user_id = r.user_id;

    IF v_wallet_saldo IS NOT NULL AND v_wallet_saldo >= v_nominal THEN
      UPDATE public.wallets SET saldo = saldo - v_nominal WHERE user_id = r.user_id;

      INSERT INTO public.simpanan (user_id, jenis, nominal, status, catatan, created_by, verified_at)
      VALUES (r.user_id, 'wajib', v_nominal, 'verified', 'Auto-debet ' || to_char(v_periode, 'YYYY-MM'), NULL, now())
      RETURNING id INTO v_simpanan_id;

      v_ok := v_ok + 1;
      v_sum := v_sum + v_nominal;

      INSERT INTO public.notification_log (channel, template, target_user, status, ref_table, ref_id, dedup_key, sent_at, payload)
      VALUES ('inapp', 'simpanan_wajib_terdebit', r.user_id, 'sent', 'simpanan', v_simpanan_id,
              'auto_debet_' || r.user_id || '_' || v_periode, now(),
              jsonb_build_object('nominal', v_nominal, 'periode', v_periode));

      INSERT INTO public.notifications (user_id, judul, pesan, kategori, ref_table, ref_id, url)
      VALUES (r.user_id, 'Simpanan wajib terdebit',
              'Saldo Anda terdebet Rp ' || to_char(v_nominal, 'FM999G999G999') || ' untuk simpanan wajib ' || to_char(v_periode, 'YYYY-MM'),
              'info', 'simpanan', v_simpanan_id, '/simpanan');
    ELSE
      INSERT INTO public.pending_iuran (user_id, periode, jenis, nominal, catatan)
      VALUES (r.user_id, v_periode, 'wajib', v_nominal,
              'Saldo tidak mencukupi saat auto-debet ' || to_char(v_periode, 'YYYY-MM'))
      ON CONFLICT DO NOTHING;

      v_fail := v_fail + 1;

      INSERT INTO public.notification_log (channel, template, target_user, status, ref_table, dedup_key, sent_at, payload)
      VALUES ('inapp', 'simpanan_wajib_gagal', r.user_id, 'sent', 'pending_iuran',
              'auto_debet_fail_' || r.user_id || '_' || v_periode, now(),
              jsonb_build_object('nominal', v_nominal, 'periode', v_periode));

      INSERT INTO public.notifications (user_id, judul, pesan, kategori, url)
      VALUES (r.user_id, 'Simpanan wajib belum terbayar',
              'Saldo dompet tidak cukup untuk auto-debet simpanan wajib ' || to_char(v_periode, 'YYYY-MM') ||
              '. Mohon top-up saldo Rp ' || to_char(v_nominal, 'FM999G999G999'),
              'peringatan', '/simpanan');
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_ok, v_fail, v_sum;
END;
$$;