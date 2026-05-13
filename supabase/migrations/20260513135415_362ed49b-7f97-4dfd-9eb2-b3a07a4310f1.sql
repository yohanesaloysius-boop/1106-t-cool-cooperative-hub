-- Enable realtime for core cooperative tables
ALTER TABLE public.simpanan REPLICA IDENTITY FULL;
ALTER TABLE public.pinjaman REPLICA IDENTITY FULL;
ALTER TABLE public.angsuran REPLICA IDENTITY FULL;
ALTER TABLE public.transaksi REPLICA IDENTITY FULL;
ALTER TABLE public.shu REPLICA IDENTITY FULL;
ALTER TABLE public.approvals REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.meeting_attendances REPLICA IDENTITY FULL;
ALTER TABLE public.meeting_notes REPLICA IDENTITY FULL;
ALTER TABLE public.pengumuman REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'simpanan','pinjaman','angsuran','transaksi','shu','approvals',
    'notifications','audit_logs','meetings','meeting_attendances',
    'meeting_notes','pengumuman'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;