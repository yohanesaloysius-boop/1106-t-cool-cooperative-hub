-- Auto-insert transaksi row when SHU is approved/distributed
CREATE OR REPLACE FUNCTION public.shu_to_transaksi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dibagikan_at IS NOT NULL AND OLD.dibagikan_at IS NULL THEN
    INSERT INTO public.transaksi (user_id, jenis, arah, nominal, ref_table, ref_id, keterangan)
    VALUES (
      NEW.user_id,
      'shu_diterima',
      'kredit',
      NEW.nominal,
      'shu',
      NEW.id,
      'SHU tahun ' || NEW.tahun
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shu_to_transaksi ON public.shu;
CREATE TRIGGER trg_shu_to_transaksi
AFTER UPDATE OF dibagikan_at ON public.shu
FOR EACH ROW
EXECUTE FUNCTION public.shu_to_transaksi();