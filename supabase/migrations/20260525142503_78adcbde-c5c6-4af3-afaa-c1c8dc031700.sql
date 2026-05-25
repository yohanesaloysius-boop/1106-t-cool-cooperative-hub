ALTER TABLE public.church_purchase_requests
  ADD COLUMN IF NOT EXISTS vendor_nama text,
  ADD COLUMN IF NOT EXISTS vendor_telepon text;