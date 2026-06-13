-- 1) Perbaiki trigger: simpanan terverifikasi TIDAK mengkredit dompet marketplace
CREATE OR REPLACE FUNCTION public.simpanan_on_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    IF NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE ref_table = 'simpanan' AND ref_id = NEW.id AND judul = '✅ Simpanan diverifikasi'
    ) THEN
      INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
      VALUES (
        NEW.user_id,
        '✅ Simpanan diverifikasi',
        'Simpanan ' || NEW.jenis::text || ' Rp ' || to_char(NEW.nominal, 'FM999G999G999') || ' sudah diverifikasi dan tercatat di buku simpanan Anda.',
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

-- 2) Kembalikan saldo dompet yang keliru bertambah dari simpanan
WITH s AS (
  SELECT wallet_id, SUM(nominal) AS total
  FROM public.wallet_transactions
  WHERE ref_table = 'simpanan' AND arah = 'in'
  GROUP BY wallet_id
)
UPDATE public.wallets w
SET saldo = GREATEST(0, w.saldo - s.total), updated_at = now()
FROM s
WHERE w.id = s.wallet_id;

-- 3) Hapus catatan mutasi dompet yang berasal dari simpanan
DELETE FROM public.wallet_transactions
WHERE ref_table = 'simpanan';