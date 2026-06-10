-- Fix SHU trigger to use valid enum value
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
      NEW.user_id, 'shu_keluar', 'debit', NEW.nominal,
      'shu', NEW.id, 'SHU dibagikan tahun ' || NEW.tahun
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix tabjangka trigger jenis: tabungan_setor → simpanan_masuk (valid enum)
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
      NEW.user_id, 'simpanan_masuk', 'kredit', NEW.nominal,
      'tabungan_berjangka', NEW.id,
      'Setoran deposito ' || NEW.tenor_bulan || ' bulan'
    );

    INSERT INTO public.notifications (user_id, judul, pesan, kategori, url, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'Tabungan Berjangka Diaktifkan',
      'Deposito Anda sebesar ' || to_char(NEW.nominal, 'FM999G999G999G999') ||
        ' (' || NEW.tenor_bulan || ' bulan, bunga ' || NEW.bunga_persen || '%) telah aktif. Jatuh tempo: ' ||
        COALESCE(to_char(NEW.tanggal_jatuh_tempo, 'DD Mon YYYY'), '-'),
      'sukses', '/tabungan-berjangka', 'tabungan_berjangka', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- OPEX paid → Buku Kas (pengeluaran/debit)
CREATE OR REPLACE FUNCTION public.opex_to_buku_kas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.transaksi (user_id, jenis, arah, nominal, ref_table, ref_id, keterangan, tanggal)
    VALUES (
      NULL, 'biaya_admin', 'debit', NEW.nominal,
      'opex_expenses', NEW.id,
      COALESCE(NEW.nomor_bukti || ' - ', '') || NEW.deskripsi,
      COALESCE(NEW.paid_at::date, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opex_to_buku_kas ON public.opex_expenses;
CREATE TRIGGER trg_opex_to_buku_kas
AFTER UPDATE OF status ON public.opex_expenses
FOR EACH ROW
EXECUTE FUNCTION public.opex_to_buku_kas();

-- Marketplace transaksi completed → fee koperasi masuk Buku Kas
CREATE OR REPLACE FUNCTION public.mp_fee_to_buku_kas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND COALESCE(NEW.fee_nominal, 0) > 0 THEN
    INSERT INTO public.transaksi (user_id, jenis, arah, nominal, ref_table, ref_id, keterangan, tanggal)
    VALUES (
      NULL, 'lainnya', 'kredit', NEW.fee_nominal,
      'marketplace_transactions', NEW.id,
      'Fee marketplace (' || NEW.fee_persen || '%) trx #' || substr(NEW.id::text, 1, 8),
      COALESCE(NEW.received_at::date, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mp_fee_to_buku_kas ON public.marketplace_transactions;
CREATE TRIGGER trg_mp_fee_to_buku_kas
AFTER UPDATE OF status ON public.marketplace_transactions
FOR EACH ROW
EXECUTE FUNCTION public.mp_fee_to_buku_kas();