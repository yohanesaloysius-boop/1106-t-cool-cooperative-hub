CREATE OR REPLACE FUNCTION public.sync_loan_verification_on_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_id IS NOT NULL
     AND NEW.status IN ('approved','disbursed','completed')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    UPDATE public.loan_verifications
       SET status = 'verified',
           verified_at = COALESCE(verified_at, now()),
           updated_at = now()
     WHERE id = NEW.verification_id
       AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_loan_verification ON public.pinjaman;
CREATE TRIGGER trg_sync_loan_verification
AFTER INSERT OR UPDATE OF status ON public.pinjaman
FOR EACH ROW EXECUTE FUNCTION public.sync_loan_verification_on_status();

UPDATE public.loan_verifications lv
   SET status = 'verified',
       verified_at = COALESCE(lv.verified_at, now()),
       updated_at = now()
  FROM public.pinjaman p
 WHERE p.verification_id = lv.id
   AND lv.status = 'pending'
   AND p.status IN ('approved','disbursed','completed');