
-- Enums
CREATE TYPE church_pr_status AS ENUM (
  'draft','submitted','approved_finance','approved_ketua',
  'forwarded_to_koperasi','vendor_selected','po_issued',
  'paid_vendor','fee_paid','received','closed','rejected','cancelled'
);
CREATE TYPE church_pr_urgensi AS ENUM ('rendah','normal','tinggi','mendesak');
CREATE TYPE church_po_status AS ENUM ('issued','paid','delivered','cancelled');
CREATE TYPE church_payment_type AS ENUM ('to_vendor','fee_koperasi');

-- Divisions
CREATE TABLE public.church_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  deskripsi text,
  pic_user_id uuid,
  kontak text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Vendors (church)
CREATE TABLE public.church_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  kategori text,
  kontak_nama text,
  telepon text,
  email text,
  alamat text,
  bank_nama text,
  bank_no_rek text,
  bank_atas_nama text,
  rating numeric DEFAULT 0,
  catatan text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Purchase Requests
CREATE TABLE public.church_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_pr text UNIQUE,
  division_id uuid NOT NULL REFERENCES public.church_divisions(id),
  requester_id uuid NOT NULL,
  judul text NOT NULL,
  tujuan text,
  urgensi church_pr_urgensi NOT NULL DEFAULT 'normal',
  status church_pr_status NOT NULL DEFAULT 'draft',
  est_total numeric NOT NULL DEFAULT 0,
  fee_persen numeric NOT NULL DEFAULT 2,
  fee_nominal numeric NOT NULL DEFAULT 0,
  approved_finance_by uuid,
  approved_finance_at timestamptz,
  approved_ketua_by uuid,
  approved_ketua_at timestamptz,
  rejected_reason text,
  rejected_by uuid,
  rejected_at timestamptz,
  koperasi_handler_id uuid,
  forwarded_at timestamptz,
  closed_at timestamptz,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_church_pr_status ON public.church_purchase_requests(status);
CREATE INDEX idx_church_pr_division ON public.church_purchase_requests(division_id);
CREATE INDEX idx_church_pr_requester ON public.church_purchase_requests(requester_id);

-- PR Items
CREATE TABLE public.church_pr_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.church_purchase_requests(id) ON DELETE CASCADE,
  nama_barang text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  satuan text DEFAULT 'pcs',
  est_harga_satuan numeric NOT NULL DEFAULT 0,
  est_subtotal numeric NOT NULL DEFAULT 0,
  harga_aktual numeric,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_church_pr_items_pr ON public.church_pr_items(pr_id);

-- Purchase Orders
CREATE TABLE public.church_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.church_purchase_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.church_vendors(id),
  nomor_po text UNIQUE,
  total_nilai numeric NOT NULL DEFAULT 0,
  tanggal_po date NOT NULL DEFAULT CURRENT_DATE,
  status church_po_status NOT NULL DEFAULT 'issued',
  file_po_url text,
  catatan text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_church_po_pr ON public.church_purchase_orders(pr_id);

-- Payments
CREATE TABLE public.church_pr_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.church_purchase_requests(id) ON DELETE CASCADE,
  tipe church_payment_type NOT NULL,
  nominal numeric NOT NULL,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  metode text,
  bukti_url text,
  catatan text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_church_pay_pr ON public.church_pr_payments(pr_id);

-- Receipts (serah terima)
CREATE TABLE public.church_pr_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.church_purchase_requests(id) ON DELETE CASCADE,
  tanggal_terima date NOT NULL DEFAULT CURRENT_DATE,
  penerima_id uuid NOT NULL,
  kondisi text,
  foto_url text,
  ttd_url text,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit trail
CREATE TABLE public.church_pr_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.church_purchase_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status church_pr_status,
  to_status church_pr_status,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_church_pr_audit_pr ON public.church_pr_audit(pr_id);

-- Auto fee calculation trigger
CREATE OR REPLACE FUNCTION public.church_pr_calc_fee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved_finance' AND (OLD.status IS DISTINCT FROM 'approved_finance') THEN
    NEW.fee_nominal := ROUND(COALESCE(NEW.est_total,0) * COALESCE(NEW.fee_persen,2) / 100);
    NEW.approved_finance_at := COALESCE(NEW.approved_finance_at, now());
  END IF;
  IF NEW.status = 'approved_ketua' AND (OLD.status IS DISTINCT FROM 'approved_ketua') THEN
    NEW.approved_ketua_at := COALESCE(NEW.approved_ketua_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_church_pr_calc_fee
BEFORE UPDATE ON public.church_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.church_pr_calc_fee();

-- Auto-generate PR number
CREATE OR REPLACE FUNCTION public.church_pr_set_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  seq int;
BEGIN
  IF NEW.nomor_pr IS NULL THEN
    SELECT COUNT(*)+1 INTO seq FROM public.church_purchase_requests
      WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
    NEW.nomor_pr := 'PR-G-' || yr || '-' || LPAD(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_church_pr_set_number
BEFORE INSERT ON public.church_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.church_pr_set_number();

-- Audit trigger on status change
CREATE OR REPLACE FUNCTION public.church_pr_log_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.church_pr_audit(pr_id, actor_id, action, to_status)
    VALUES (NEW.id, NEW.requester_id, 'created', NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.church_pr_audit(pr_id, actor_id, action, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_church_pr_audit_ins
AFTER INSERT ON public.church_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.church_pr_log_audit();

CREATE TRIGGER trg_church_pr_audit_upd
AFTER UPDATE ON public.church_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.church_pr_log_audit();

-- Helper: is ketua
CREATE OR REPLACE FUNCTION public.is_ketua(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('ketua','super_admin') AND deleted_at IS NULL);
$$;

-- RLS
ALTER TABLE public.church_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_pr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_pr_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_pr_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_pr_audit ENABLE ROW LEVEL SECURITY;

-- Divisions: readable by all authenticated, manage by pengurus
CREATE POLICY "div read auth" ON public.church_divisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "div manage pengurus" ON public.church_divisions FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

-- Vendors: readable by all authenticated, manage by pengurus
CREATE POLICY "vendor read auth" ON public.church_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendor manage pengurus" ON public.church_vendors FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

-- PR
CREATE POLICY "pr view own or pengurus" ON public.church_purchase_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR is_pengurus(auth.uid()));
CREATE POLICY "pr insert own" ON public.church_purchase_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "pr update own draft or pengurus" ON public.church_purchase_requests FOR UPDATE TO authenticated
  USING ((requester_id = auth.uid() AND status IN ('draft','submitted')) OR is_pengurus(auth.uid()));

-- PR Items
CREATE POLICY "pri view related" ON public.church_pr_items FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "pri write own draft or pengurus" ON public.church_pr_items FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND ((p.requester_id = auth.uid() AND p.status IN ('draft','submitted')) OR is_pengurus(auth.uid()))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND ((p.requester_id = auth.uid() AND p.status IN ('draft','submitted')) OR is_pengurus(auth.uid()))));

-- PO, payments, receipts: only pengurus write; requester can view
CREATE POLICY "po view related" ON public.church_purchase_orders FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "po pengurus write" ON public.church_purchase_orders FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE POLICY "pay view related" ON public.church_pr_payments FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "pay pengurus write" ON public.church_pr_payments FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE POLICY "rcp view related" ON public.church_pr_receipts FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "rcp pengurus write" ON public.church_pr_receipts FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE POLICY "audit view related" ON public.church_pr_audit FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.church_purchase_requests p WHERE p.id = pr_id
    AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "audit insert auth" ON public.church_pr_audit FOR INSERT TO authenticated
  WITH CHECK (true);
