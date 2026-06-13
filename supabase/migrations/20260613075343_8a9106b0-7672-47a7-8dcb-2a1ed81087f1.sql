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
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.transaksi WHERE ref_table = 'simpanan' AND ref_id = NEW.id
    ) THEN
      INSERT INTO public.transaksi (user_id, jenis, arah, nominal, ref_table, ref_id, keterangan, tanggal)
      VALUES (
        NEW.user_id,
        'simpanan_masuk',
        'kredit',
        NEW.nominal,
        'simpanan',
        NEW.id,
        'Simpanan ' || NEW.jenis::text || COALESCE(' — ' || NEW.catatan, ''),
        COALESCE(NEW.updated_at::date, CURRENT_DATE)
      );
    END IF;

    v_wallet := public.get_or_create_wallet(NEW.user_id);
    SELECT saldo INTO v_dummy FROM public.wallets WHERE id = v_wallet FOR UPDATE;
    UPDATE public.wallets
    SET saldo = saldo + NEW.nominal, updated_at = now()
    WHERE id = v_wallet;

    IF NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions WHERE ref_table = 'simpanan' AND ref_id = NEW.id
    ) THEN
      INSERT INTO public.wallet_transactions
        (wallet_id, user_id, arah, nominal, jenis, ref_table, ref_id, keterangan)
      VALUES (
        v_wallet,
        NEW.user_id,
        'in',
        NEW.nominal,
        'deposit',
        'simpanan',
        NEW.id,
        'Simpanan ' || NEW.jenis::text || ' diverifikasi'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE ref_table = 'simpanan' AND ref_id = NEW.id AND judul = '✅ Simpanan diverifikasi'
    ) THEN
      INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
      VALUES (
        NEW.user_id,
        '✅ Simpanan diverifikasi',
        'Simpanan ' || NEW.jenis::text || ' Rp ' || to_char(NEW.nominal, 'FM999G999G999') || ' sudah diverifikasi dan masuk ke saldo dompet Anda.',
        'sukses',
        '/simpanan',
        'simpanan',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_simpanan_on_approved ON public.simpanan;
CREATE TRIGGER trg_simpanan_on_approved
AFTER UPDATE OF status ON public.simpanan
FOR EACH ROW EXECUTE FUNCTION public.simpanan_on_approved();