-- Critical #3: race condition di simpanan_on_approved — lock wallet row
CREATE OR REPLACE FUNCTION public.simpanan_on_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet uuid;
  v_dummy numeric;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.transaksi WHERE ref_table='simpanan' AND ref_id=NEW.id
    ) THEN
      INSERT INTO public.transaksi (user_id, jenis, arah, nominal, ref_table, ref_id, keterangan, tanggal)
      VALUES (NEW.user_id, 'simpanan_masuk', 'kredit', NEW.nominal,
              'simpanan', NEW.id,
              'Simpanan ' || NEW.jenis::text || COALESCE(' — ' || NEW.catatan, ''),
              COALESCE(NEW.updated_at::date, CURRENT_DATE));
    END IF;

    v_wallet := public.get_or_create_wallet(NEW.user_id);
    -- Lock dompet sebelum update agar bebas race-condition
    SELECT saldo INTO v_dummy FROM public.wallets WHERE id = v_wallet FOR UPDATE;
    UPDATE public.wallets SET saldo = saldo + NEW.nominal, updated_at = now() WHERE id = v_wallet;

    INSERT INTO public.wallet_transactions
      (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan)
    VALUES (v_wallet, NEW.user_id, 'in', NEW.nominal, 'deposit',
            'simpanan', NEW.id,
            'Simpanan ' || NEW.jenis::text || ' diverifikasi');

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (NEW.user_id, '✅ Simpanan diverifikasi',
            'Simpanan ' || NEW.jenis::text || ' Rp ' || to_char(NEW.nominal,'FM999G999G999') ||
            ' sudah diverifikasi dan masuk ke saldo dompet Anda.',
            'sukses', '/simpanan', 'simpanan', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Critical #2: batasi akses ke fungsi identitas Super Admin
REVOKE EXECUTE ON FUNCTION public.is_sa_identity(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_sa_identity(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_email_by_phone(text) TO service_role;

-- Trigger anti-impersonasi: cegah user biasa mengubah email/no_hp menjadi identitas SA
CREATE OR REPLACE FUNCTION public.prevent_sa_identity_takeover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_sa boolean;
BEGIN
  -- Jika tidak ada perubahan email/no_hp, lewati
  IF NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.no_hp IS NOT DISTINCT FROM OLD.no_hp THEN
    RETURN NEW;
  END IF;

  -- Apakah nilai baru cocok dengan identitas SA?
  v_is_sa := public.is_sa_identity(NEW.email, NEW.no_hp);
  IF NOT v_is_sa THEN
    RETURN NEW;
  END IF;

  -- Nilai baru = identitas SA. Hanya boleh jika row ini memang sudah SA,
  -- atau aktor adalah pengurus (super_admin/ketua/sekretaris/bendahara),
  -- atau dijalankan oleh service_role / definer (auth.uid() IS NULL).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_pengurus(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF public.is_sa_identity(OLD.email, OLD.no_hp) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Tidak diizinkan: email/no_hp tersebut dilindungi.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sa_identity_takeover ON public.profiles;
CREATE TRIGGER trg_prevent_sa_identity_takeover
BEFORE UPDATE OF email, no_hp ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_sa_identity_takeover();
