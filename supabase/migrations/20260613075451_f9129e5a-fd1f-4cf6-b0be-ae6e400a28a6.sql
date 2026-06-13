DO $$
BEGIN
  ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'approved';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;