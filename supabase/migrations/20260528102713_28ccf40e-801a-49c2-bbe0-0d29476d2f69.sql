
CREATE OR REPLACE FUNCTION public.gen_qris_invoice_no()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.qris_invoice_seq');
  RETURN 'TCQR-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(n::text, 5, '0');
END $function$;
