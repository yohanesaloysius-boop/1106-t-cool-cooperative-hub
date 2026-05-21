import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Loader2, ShieldAlert, CheckCircle2, Clock, XCircle, FileSpreadsheet, ArrowDownToLine } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/qris")({
  head: () => ({ meta: [{ title: "Monitoring QRIS — Admin" }] }),
  component: AdminQRIS,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function statusBadge(s: string) {
  const map: Record<string, { cls: string; icon: any }> = {
    pending: { cls: "border-amber-500 text-amber-700", icon: Clock },
    success: { cls: "bg-emerald-600 text-white border-transparent", icon: CheckCircle2 },
    expired: { cls: "bg-muted", icon: XCircle },
    failed: { cls: "bg-destructive text-destructive-foreground border-transparent", icon: XCircle },
    cancelled: { cls: "bg-muted", icon: XCircle },
  };
  const m = map[s] ?? map.pending;
  const I = m.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}><I className="h-3 w-3" />{s}</span>;
}

function AdminQRIS() {
  const { isPengurus, loading } = useAuth();
  const qc = useQueryClient();
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("all");
  const [jenis, setJenis] = useState<string>("all");
  const [q, setQ] = useState("");

  useRealtime("qris_payments", () => qc.invalidateQueries({ queryKey: ["admin-qris"] }));

  const query = useQuery({
    queryKey: ["admin-qris", from, to],
    enabled: isPengurus,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qris_payments")
        .select("id,invoice_no,user_id,jenis,nominal,status,keterangan,expired_at,paid_at,created_at,profiles!qris_payments_user_id_fkey(nama_lengkap,nomor_anggota)")
        .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false }).limit(500);
      if (error) {
        // fallback without join if FK alias not present
        const r2 = await supabase.from("qris_payments").select("*").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`).order("created_at", { ascending: false }).limit(500);
        if (r2.error) throw r2.error;
        const ids = Array.from(new Set((r2.data ?? []).map((x: any) => x.user_id)));
        const { data: profs } = ids.length ? await supabase.from("profiles").select("id,nama_lengkap,nomor_anggota").in("id", ids) : { data: [] as any[] };
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return (r2.data ?? []).map((x: any) => ({ ...x, profile: map.get(x.user_id) }));
      }
      return (data ?? []).map((x: any) => ({ ...x, profile: x.profiles }));
    },
  });

  const filtered = useMemo(() => {
    return (query.data ?? []).filter((r: any) => {
      if (status !== "all" && r.status !== status) return false;
      if (jenis !== "all" && r.jenis !== jenis) return false;
      if (q) {
        const t = q.toLowerCase();
        if (!(r.invoice_no.toLowerCase().includes(t) || (r.profile?.nama_lengkap ?? "").toLowerCase().includes(t) || (r.keterangan ?? "").toLowerCase().includes(t))) return false;
      }
      return true;
    });
  }, [query.data, status, jenis, q]);

  const totals = useMemo(() => {
    let success = 0, pending = 0, expired = 0, sumSuccess = 0;
    filtered.forEach((r: any) => {
      if (r.status === "success") { success++; sumSuccess += Number(r.nominal); }
      else if (r.status === "pending") pending++;
      else if (r.status === "expired") expired++;
    });
    return { success, pending, expired, sumSuccess, total: filtered.length };
  }, [filtered]);

  const markSuccess = async (id: string) => {
    const { error } = await supabase.rpc("qris_mark_success", { _id: id });
    if (error) toast.error(error.message);
    else toast.success("Pembayaran ditandai berhasil");
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(filtered.map((r: any) => ({
      Invoice: r.invoice_no, Anggota: r.profile?.nama_lengkap ?? "-", Nomor: r.profile?.nomor_anggota ?? "-",
      Jenis: r.jenis, Nominal: Number(r.nominal), Status: r.status, Keterangan: r.keterangan ?? "",
      Dibuat: new Date(r.created_at).toLocaleString("id-ID"),
      Dibayar: r.paid_at ? new Date(r.paid_at).toLocaleString("id-ID") : "",
    })));
    XLSX.utils.book_append_sheet(wb, sheet, "QRIS");
    XLSX.writeFile(wb, `QRIS-${from}_${to}.xlsx`);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isPengurus) return <Card className="p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><p className="mt-2 text-sm">Akses khusus pengurus.</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-white/80"><QrCode className="h-4 w-4" /> Monitoring QRIS</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold">Pembayaran QRIS Koperasi</h1>
        <p className="mt-1 text-sm text-white/80">Realtime — semua transaksi QRIS anggota tampil otomatis di sini.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Transaksi</div><p className="mt-1 text-lg font-bold">{totals.total}</p></Card>
        <Card className="p-4"><div className="text-xs text-emerald-700">Berhasil</div><p className="mt-1 text-lg font-bold text-emerald-700">{totals.success}</p><p className="text-[10px] text-muted-foreground">{fmt.format(totals.sumSuccess)}</p></Card>
        <Card className="p-4"><div className="text-xs text-amber-700">Pending</div><p className="mt-1 text-lg font-bold text-amber-700">{totals.pending}</p></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kedaluwarsa</div><p className="mt-1 text-lg font-bold">{totals.expired}</p></Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div><Label className="text-xs">Dari</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Sampai</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Berhasil</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="failed">Gagal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Jenis</Label>
            <Select value={jenis} onValueChange={setJenis}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="simpanan">Simpanan</SelectItem>
                <SelectItem value="angsuran">Angsuran</SelectItem>
                <SelectItem value="topup">Topup</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]"><Label className="text-xs">Cari</Label><Input placeholder="Invoice / nama / keterangan" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button onClick={exportXlsx} disabled={!filtered.length}><FileSpreadsheet className="mr-2 h-4 w-4" />Export</Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" />Daftar Transaksi</CardTitle></CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : !filtered.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.profile?.nama_lengkap ?? "-"}</div>
                      <div className="text-[10px] text-muted-foreground">{r.profile?.nomor_anggota ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.jenis}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt.format(Number(r.nominal))}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => markSuccess(r.id)}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Tandai Sukses
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
