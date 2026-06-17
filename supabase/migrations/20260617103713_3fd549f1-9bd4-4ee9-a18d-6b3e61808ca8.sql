-- Hapus trigger notifikasi yang tumpang tindih (menyebabkan notifikasi ganda)
DROP TRIGGER IF EXISTS trg_notify_marketplace_trx_ins ON public.marketplace_transactions;
DROP TRIGGER IF EXISTS trg_notify_marketplace_trx_upd ON public.marketplace_transactions;

-- Pastikan satu trigger gabungan tetap aktif (INSERT + UPDATE)
DROP TRIGGER IF EXISTS trg_notify_mp_trx ON public.marketplace_transactions;
CREATE TRIGGER trg_notify_mp_trx
AFTER INSERT OR UPDATE ON public.marketplace_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_marketplace_trx();