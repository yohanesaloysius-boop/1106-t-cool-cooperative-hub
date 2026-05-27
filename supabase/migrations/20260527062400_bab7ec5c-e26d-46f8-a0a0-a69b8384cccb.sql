
CREATE TYPE public.school_pr_status AS ENUM (
  'draft','submitted','approved_finance','approved_ketua','forwarded_to_koperasi',
  'vendor_selected','po_issued','paid_vendor','fee_paid','received','closed','rejected','cancelled'
);
CREATE TYPE public.school_pr_urgensi AS ENUM ('rendah','normal','tinggi','mendesak');
CREATE TYPE public.school_po_status AS ENUM ('issued','partial','done','cancelled');
CREATE TYPE public.school_payment_type AS ENUM ('to_vendor','fee_koperasi');

CREATE TABLE public.school_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  deskripsi text,
  pic_user_id uuid,
  kontak text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_divisions TO authenticated;
GRANT ALL ON public.school_divisions TO service_role;
ALTER TABLE public.school_divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdiv read auth" ON public.school_divisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdiv manage pengurus" ON public.school_divisions FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE TABLE public.school_requesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  jabatan text NOT NULL,
  division_id uuid REFERENCES public.school_divisions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  appointed_by uuid,
  appointed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_requesters TO authenticated;
GRANT ALL ON public.school_requesters TO service_role;
ALTER TABLE public.school_requesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sreq view own or pengurus" ON public.school_requesters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_pengurus(auth.uid()));
CREATE POLICY "sreq pengurus manage" ON public.school_requesters FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
CREATE TRIGGER trg_school_requesters_updated BEFORE UPDATE ON public.school_requesters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.school_vendors (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_vendors TO authenticated;
GRANT ALL ON public.school_vendors TO service_role;
ALTER TABLE public.school_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svendor read auth" ON public.school_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "svendor manage pengurus" ON public.school_vendors FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE TABLE public.school_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_pr text UNIQUE,
  division_id uuid NOT NULL REFERENCES public.school_divisions(id),
  requester_id uuid NOT NULL,
  judul text NOT NULL,
  tujuan text,
  urgensi school_pr_urgensi NOT NULL DEFAULT 'normal',
  status school_pr_status NOT NULL DEFAULT 'draft',
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
  vendor_nama text,
  vendor_telepon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_pr_division ON public.school_purchase_requests(division_id);
CREATE INDEX idx_school_pr_requester ON public.school_purchase_requests(requester_id);
CREATE INDEX idx_school_pr_status ON public.school_purchase_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_purchase_requests TO authenticated;
GRANT ALL ON public.school_purchase_requests TO service_role;
ALTER TABLE public.school_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_school_requester(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM public.school_requesters WHERE user_id = _uid AND is_active = true);
$$;

CREATE POLICY "spr view own or pengurus" ON public.school_purchase_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR is_pengurus(auth.uid()));
CREATE POLICY "spr insert authorized" ON public.school_purchase_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND (is_school_requester(auth.uid()) OR is_pengurus(auth.uid())));
CREATE POLICY "spr update own draft or pengurus" ON public.school_purchase_requests FOR UPDATE TO authenticated
  USING (
    (requester_id = auth.uid() AND status = ANY (ARRAY['draft'::school_pr_status,'submitted'::school_pr_status]))
    OR is_pengurus(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.school_pr_set_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE yr text := to_char(now(), 'YYYY'); seq int;
BEGIN
  IF NEW.nomor_pr IS NULL THEN
    SELECT COUNT(*)+1 INTO seq FROM public.school_purchase_requests
      WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
    NEW.nomor_pr := 'PR-S-' || yr || '-' || LPAD(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.school_pr_calc_fee()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
END; $$;

CREATE TABLE public.school_pr_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.school_purchase_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status school_pr_status,
  to_status school_pr_status,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_pr_audit_pr ON public.school_pr_audit(pr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_pr_audit TO authenticated;
GRANT ALL ON public.school_pr_audit TO service_role;
ALTER TABLE public.school_pr_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saudit insert auth" ON public.school_pr_audit FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "saudit view related" ON public.school_pr_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_pr_audit.pr_id AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));

CREATE OR REPLACE FUNCTION public.school_pr_log_audit()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.school_pr_audit(pr_id, actor_id, action, to_status)
    VALUES (NEW.id, NEW.requester_id, 'created', NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.school_pr_audit(pr_id, actor_id, action, from_status, to_status)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_school_pr_set_number BEFORE INSERT ON public.school_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.school_pr_set_number();
CREATE TRIGGER trg_school_pr_calc_fee BEFORE UPDATE ON public.school_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.school_pr_calc_fee();
CREATE TRIGGER trg_school_pr_audit_ins AFTER INSERT ON public.school_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.school_pr_log_audit();
CREATE TRIGGER trg_school_pr_audit_upd AFTER UPDATE ON public.school_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.school_pr_log_audit();

CREATE TABLE public.school_pr_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.school_purchase_requests(id) ON DELETE CASCADE,
  nama_barang text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  satuan text DEFAULT 'pcs',
  est_harga_satuan numeric NOT NULL DEFAULT 0,
  est_subtotal numeric NOT NULL DEFAULT 0,
  harga_aktual numeric,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_pr_items_pr ON public.school_pr_items(pr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_pr_items TO authenticated;
GRANT ALL ON public.school_pr_items TO service_role;
ALTER TABLE public.school_pr_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spri view related" ON public.school_pr_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_pr_items.pr_id AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "spri write own draft or pengurus" ON public.school_pr_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_pr_items.pr_id AND
      ((p.requester_id = auth.uid() AND p.status = ANY(ARRAY['draft'::school_pr_status,'submitted'::school_pr_status]))
       OR is_pengurus(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_pr_items.pr_id AND
      ((p.requester_id = auth.uid() AND p.status = ANY(ARRAY['draft'::school_pr_status,'submitted'::school_pr_status]))
       OR is_pengurus(auth.uid()))));

CREATE TABLE public.school_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.school_purchase_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.school_vendors(id),
  nomor_po text UNIQUE,
  total_nilai numeric NOT NULL DEFAULT 0,
  tanggal_po date NOT NULL DEFAULT CURRENT_DATE,
  status school_po_status NOT NULL DEFAULT 'issued',
  file_po_url text,
  catatan text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_po_pr ON public.school_purchase_orders(pr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_purchase_orders TO authenticated;
GRANT ALL ON public.school_purchase_orders TO service_role;
ALTER TABLE public.school_purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spo view related" ON public.school_purchase_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_purchase_orders.pr_id AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "spo pengurus write" ON public.school_purchase_orders FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE TABLE public.school_pr_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.school_purchase_requests(id) ON DELETE CASCADE,
  tipe school_payment_type NOT NULL,
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
CREATE INDEX idx_school_pay_pr ON public.school_pr_payments(pr_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_pr_payments TO authenticated;
GRANT ALL ON public.school_pr_payments TO service_role;
ALTER TABLE public.school_pr_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spay view related" ON public.school_pr_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_pr_payments.pr_id AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "spay pengurus write" ON public.school_pr_payments FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));

CREATE TABLE public.school_pr_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.school_purchase_requests(id) ON DELETE CASCADE,
  tanggal_terima date NOT NULL DEFAULT CURRENT_DATE,
  penerima_id uuid NOT NULL,
  kondisi text,
  foto_url text,
  ttd_url text,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_pr_receipts TO authenticated;
GRANT ALL ON public.school_pr_receipts TO service_role;
ALTER TABLE public.school_pr_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srcp view related" ON public.school_pr_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_purchase_requests p
    WHERE p.id = school_pr_receipts.pr_id AND (p.requester_id = auth.uid() OR is_pengurus(auth.uid()))));
CREATE POLICY "srcp pengurus write" ON public.school_pr_receipts FOR ALL TO authenticated
  USING (is_pengurus(auth.uid())) WITH CHECK (is_pengurus(auth.uid()));
