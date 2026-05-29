// Escrow & wallet API untuk Marketplace Koperasi
import { supabase } from "@/integrations/supabase/client";

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

export type Wallet = {
  id: string;
  user_id: string | null;
  saldo: number;
  saldo_escrow: number;
};

export type WalletTrx = {
  id: string;
  wallet_id: string;
  user_id: string | null;
  arah: "in" | "out";
  nominal: number;
  jenis: string;
  ref_table: string | null;
  ref_id: string | null;
  keterangan: string | null;
  created_at: string;
};

export type Withdrawal = {
  id: string;
  user_id: string;
  nominal: number;
  bank_nama: string | null;
  bank_no_rek: string | null;
  bank_atas_nama: string | null;
  status: WithdrawalStatus;
  catatan: string | null;
  bukti_transfer_url: string | null;
  requested_at: string;
  processed_at: string | null;
};

// ---------- Settings ----------
export async function getMarketplaceRekening(): Promise<{
  bank: string;
  no_rek: string;
  atas_nama: string;
}> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "marketplace_rekening")
    .maybeSingle();
  const v = (data?.value ?? {}) as any;
  return {
    bank: v.bank ?? "CIMB Niaga",
    no_rek: v.no_rek ?? "7059 7764 0990",
    atas_nama: v.atas_nama ?? "Koperasi T-COOL Sejahtera",
  };
}

export async function getMarketplaceFeePersen(): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "marketplace_fee_persen")
    .maybeSingle();
  return Number(data?.value ?? 5);
}

// ---------- Wallet ----------
export async function getMyWallet(userId: string): Promise<Wallet> {
  const { data } = await supabase
    .from("wallets" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as unknown as Wallet;
  return { id: "", user_id: userId, saldo: 0, saldo_escrow: 0 };
}

export async function getKoperasiWallet(): Promise<Wallet> {
  const { data } = await supabase
    .from("wallets" as any)
    .select("*")
    .is("user_id", null)
    .maybeSingle();
  if (data) return data as unknown as Wallet;
  return { id: "", user_id: null, saldo: 0, saldo_escrow: 0 };
}

export async function listMyWalletTrx(userId: string, limit = 50): Promise<WalletTrx[]> {
  const { data } = await supabase
    .from("wallet_transactions" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as WalletTrx[];
}

// ---------- Buyer actions ----------
export async function uploadBuktiTransfer(trxId: string, buktiUrl: string) {
  const { error } = await supabase.rpc("mp_upload_bukti" as any, {
    _trx_id: trxId,
    _bukti_url: buktiUrl,
  });
  if (error) throw error;
}

export async function confirmReceived(trxId: string) {
  const { error } = await supabase.rpc("mp_confirm_received" as any, { _trx_id: trxId });
  if (error) throw error;
}

// ---------- Seller actions ----------
export async function shipOrder(trxId: string, resi: string, kurir: string) {
  const { error } = await supabase.rpc("mp_ship" as any, {
    _trx_id: trxId,
    _resi: resi,
    _kurir: kurir,
  });
  if (error) throw error;
}

export async function requestWithdrawal(input: {
  nominal: number;
  bank_nama: string;
  bank_no_rek: string;
  bank_atas_nama: string;
  catatan?: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Tidak login");
  const { error } = await supabase
    .from("marketplace_withdrawals" as any)
    .insert({ user_id: u.user.id, ...input });
  if (error) throw error;
}

export async function listMyWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { data } = await supabase
    .from("marketplace_withdrawals" as any)
    .select("*")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });
  return (data ?? []) as unknown as Withdrawal[];
}

// ---------- Admin actions ----------
export async function verifyPayment(trxId: string) {
  const { error } = await supabase.rpc("mp_verify_payment" as any, { _trx_id: trxId });
  if (error) throw error;
}

export async function processWithdrawal(wdId: string, buktiUrl: string) {
  const { error } = await supabase.rpc("mp_process_withdrawal" as any, {
    _wd_id: wdId,
    _bukti_url: buktiUrl,
  });
  if (error) throw error;
}

export async function rejectWithdrawal(wdId: string, alasan: string) {
  const { error } = await supabase.rpc("mp_reject_withdrawal" as any, {
    _wd_id: wdId,
    _alasan: alasan,
  });
  if (error) throw error;
}

export async function listAllWithdrawals(): Promise<any[]> {
  const { data } = await supabase
    .from("marketplace_withdrawals" as any)
    .select("*, profiles!marketplace_withdrawals_user_id_fkey(nama_lengkap, nomor_anggota)")
    .order("requested_at", { ascending: false });
  return (data ?? []) as any[];
}

export async function listPendingPayments(): Promise<any[]> {
  const { data } = await supabase
    .from("marketplace_transactions")
    .select(
      "*, marketplace_products(nama_produk), marketplace_stores(nama_toko), profiles!marketplace_transactions_buyer_id_fkey(nama_lengkap)",
    )
    .eq("status", "pending")
    .not("bukti_transfer_url", "is", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as any[];
}

// ---------- Helpers ----------
export const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

// ---------- Komplain ----------
export async function fileComplaint(trxId: string, alasan: string, lampiranUrl?: string) {
  const { data, error } = await supabase.rpc("mp_file_complaint" as any, {
    _trx_id: trxId,
    _alasan: alasan,
    _lampiran_url: lampiranUrl ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function resolveComplaint(complaintId: string, action: "refund" | "reject", catatan: string) {
  const { error } = await supabase.rpc("mp_resolve_complaint" as any, {
    _complaint_id: complaintId,
    _action: action,
    _catatan: catatan,
  });
  if (error) throw error;
}

export async function listOpenComplaints(): Promise<any[]> {
  const { data } = await supabase
    .from("marketplace_complaints" as any)
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return (data ?? []) as any[];
}

export async function listAllComplaints(): Promise<any[]> {
  const { data } = await supabase
    .from("marketplace_complaints" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as any[];
}

export async function listMyComplaints(userId: string): Promise<any[]> {
  const { data } = await supabase
    .from("marketplace_complaints" as any)
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as any[];
}

// ---------- Seller verification ----------
export async function setStoreStatus(storeId: string, status: "active" | "pending" | "suspended" | "inactive", alasan?: string) {
  const { error } = await supabase.rpc("mp_set_store_status" as any, {
    _store_id: storeId,
    _status: status,
    _alasan: alasan ?? null,
  });
  if (error) throw error;
}

export async function listStoresByStatus(status?: string): Promise<any[]> {
  let q = supabase.from("marketplace_stores").select("*, profiles!marketplace_stores_member_id_fkey(nama_lengkap, nomor_anggota, no_hp)").order("created_at", { ascending: false });
  if (status) q = q.eq("status_toko", status as any);
  const { data } = await q;
  return (data ?? []) as any[];
}

// ---------- Admin stats ----------
export async function getAdminStats(): Promise<{
  fee_koperasi: number; escrow_total: number; gmv: number;
  completed: number; pending_verif: number; open_complaints: number;
  by_status: Record<string, number>;
}> {
  const { data, error } = await supabase.rpc("get_marketplace_admin_stats" as any);
  if (error) throw error;
  return data as any;
}

export async function getTopProducts(limit = 10): Promise<any[]> {
  const { data, error } = await supabase.rpc("get_top_products" as any, { _limit: limit });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getFeeBreakdown(): Promise<{ bulan: string; total_fee: number; total_gmv: number; jumlah_trx: number }[]> {
  const { data, error } = await supabase.rpc("get_fee_breakdown" as any);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function uploadBuktiFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/bukti/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("bukti-transfer")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  // signed URL valid 1 tahun (bucket private)
  const { data } = await supabase.storage
    .from("bukti-transfer")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}
