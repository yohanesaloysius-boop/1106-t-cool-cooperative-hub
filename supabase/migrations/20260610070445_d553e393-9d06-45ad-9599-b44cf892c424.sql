-- 1) Auto-complete pinjaman when all angsuran are paid
CREATE OR REPLACE FUNCTION public.complete_pinjaman_when_lunas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
  pinj record;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO remaining
  FROM public.angsuran
  WHERE pinjaman_id = NEW.pinjaman_id
    AND deleted_at IS NULL
    AND status <> 'paid';

  IF remaining = 0 THEN
    SELECT id, user_id, nominal, status INTO pinj
    FROM public.pinjaman
    WHERE id = NEW.pinjaman_id;

    IF pinj.status = 'disbursed' THEN
      UPDATE public.pinjaman
      SET status = 'completed', updated_at = now()
      WHERE id = NEW.pinjaman_id;

      INSERT INTO public.notifications (user_id, judul, pesan, kategori, url)
      VALUES (
        pinj.user_id,
        'Pinjaman Lunas',
        'Selamat! Seluruh cicilan pinjaman Anda telah lunas. Terima kasih atas kedisiplinan pembayaran.',
        'sukses',
        '/pinjaman'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_pinjaman_when_lunas ON public.angsuran;
CREATE TRIGGER trg_complete_pinjaman_when_lunas
AFTER UPDATE OF status ON public.angsuran
FOR EACH ROW
EXECUTE FUNCTION public.complete_pinjaman_when_lunas();

-- 2) Block pencairan pinjaman before loan_agreements is fully signed
CREATE OR REPLACE FUNCTION public.enforce_akad_before_disburse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  akad_status text;
BEGIN
  IF NEW.status = 'disbursed' AND (OLD.status IS DISTINCT FROM 'disbursed') THEN
    SELECT status INTO akad_status
    FROM public.loan_agreements
    WHERE pinjaman_id = NEW.id;

    IF akad_status IS NULL THEN
      RAISE EXCEPTION 'Pencairan ditolak: akad pinjaman belum dibuat. Generate & tandatangani akad terlebih dahulu.'
        USING ERRCODE = 'check_violation';
    ELSIF akad_status <> 'signed' THEN
      RAISE EXCEPTION 'Pencairan ditolak: akad pinjaman belum ditandatangani lengkap (status: %). Wajib ditandatangani anggota dan pengurus.', akad_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_akad_before_disburse ON public.pinjaman;
CREATE TRIGGER trg_enforce_akad_before_disburse
BEFORE UPDATE OF status ON public.pinjaman
FOR EACH ROW
EXECUTE FUNCTION public.enforce_akad_before_disburse();