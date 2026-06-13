import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getSignedUrl } from "@/lib/upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, Loader2, ShieldAlert, FileSpreadsheet, Paperclip, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/arsip-transaksi")({
  head: () => ({ meta: [{ title: "Arsip Digital Transaksi — Admin" }] }),
  component: AdminArsipTransaksi,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date | null) => d ? new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

type Tipe = "simpanan" | "angsuran" | "pinjaman" | "shu" | "marketplace";
type Row = {
  id: string;
  tipe: Tipe;
  tanggal: string;
  anggota: string;
  nominal: number;
  status: string;
  keterangan: string;
  bukti_url: string | null;
  bukti_bucket: string | null;
};

function AdminArsipTransaksi() {
  const { isPengurus, loading } = useAuth();
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [tipe, setTipe] = useState<"all" | Tipe>("all");
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["arsip-transaksi", from, to],
    enabled: isPengurus,
    queryFn: async () => {
      const fromISO = `${from}T00:00:00`;
      const toISO = `${to}T23:59:59`;
      const [{ data: simp }, { data: ang }, { data: pj }, { data: shu }, { data: mp }] = await Promise.all([
        supabase.from("simpanan").select("id,nominal,jenis,status,created_at,user_id,bukti_url").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("angsuran").select("id,nominal,status,cicilan_ke,paid_at,created_at,user_id,bukti_url").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("pinjaman").select("id,nominal,status,created_at,disbursed_at,user_id,tujuan,bukti_pencairan_url").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("shu").select("id,nominal,tahun,dibagikan_at,created_at,user_id,catatan").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("marketplace_transactions").select("id,total,status,created_at,buyer_id,bukti_transfer_url,resi,kurir").gte("created_at", fromISO).lte("created_at", toISO),
      ]);
      const ids = new Set<string>();
      [simp, ang, pj, shu].forEach((arr) => (arr ?? []).forEach((x: any) => ids.add(x.user_id)));
      (mp ?? []).forEach((x: any) => ids.add(x.buyer_id));
      const { data: profs } = ids.size
        ? await supabase.from("profiles").select("id,nama_lengkap,nomor_anggota").in("id", Array.from(ids))
        : { data: [] as any[] };
      const pmap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => pmap.set(p.id, `${p.nama_lengkap}${p.nomor_anggota ? ` (${p.nomor_anggota})` : ""}`));
      const name = (uid: string) => pmap.get(uid) ?? "-";
      const rows: Row[] = [];
      (simp ?? []).forEach((s: any) => rows.push({ id: s.id, tipe: "simpanan", tanggal: s.created_at, anggota: name(s.user_id), nominal: Number(s.nominal), status: s.status, keterangan: `Simpanan ${s.jenis}`, bukti_url: s.bukti_url, bukti_bucket: "bukti-transfer" }));
      // Hanya tampilkan angsuran yang sudah dibayar/diverifikasi sebagai laporan — jadwal cicilan yang belum dibayar tidak diarsipkan di sini.
      (ang ?? []).filter((a: any) => a.status === "paid" || a.paid_at).forEach((a: any) => rows.push({ id: a.id, tipe: "angsuran", tanggal: a.paid_at ?? a.created_at, anggota: name(a.user_id), nominal: Number(a.nominal), status: a.status, keterangan: `Angsuran ke-${a.cicilan_ke}`, bukti_url: a.bukti_url, bukti_bucket: "bukti-transfer" }));
      (pj ?? []).forEach((p: any) => rows.push({ id: p.id, tipe: "pinjaman", tanggal: p.disbursed_at ?? p.created_at, anggota: name(p.user_id), nominal: Number(p.nominal), status: p.status, keterangan: p.tujuan ?? "Pinjaman", bukti_url: p.bukti_pencairan_url, bukti_bucket: "bukti-transfer" }));
      (shu ?? []).forEach((s: any) => rows.push({ id: s.id, tipe: "shu", tanggal: s.dibagikan_at ?? s.created_at, anggota: name(s.user_id), nominal: Number(s.nominal), status: s.dibagikan_at ? "dibagikan" : "draft", keterangan: `SHU ${s.tahun}${s.catatan ? " — " + s.catatan : ""}`, bukti_url: null, bukti_bucket: null }));
      (mp ?? []).forEach((m: any) => rows.push({ id: m.id, tipe: "marketplace", tanggal: m.created_at, anggota: name(m.buyer_id), nominal: Number(m.total), status: m.status, keterangan: `Marketplace${m.resi ? ` · resi ${m.resi}` : ""}`, bukti_url: m.bukti_transfer_url, bukti_bucket: "bukti-transfer" }));
      rows.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      return rows;
    },
  });

  const filtered = useMemo(() => {
    return (query.data ?? []).filter((r) =>
      (tipe === "all" || r.tipe === tipe) &&
      (!q || r.anggota.toLowerCase().includes(q.toLowerCase()) || r.keterangan.toLowerCase().includes(q.toLowerCase()) || r.status.toLowerCase().includes(q.toLowerCase())),
    );
  }, [query.data, tipe, q]);

  const stats = useMemo(() => {
    const byTipe = new Map<string, number>();
    filtered.forEach((r) => byTipe.set(r.tipe, (byTipe.get(r.tipe) ?? 0) + 1));
    return { total: filtered.length, withBukti: filtered.filter((r) => r.bukti_url).length, byTipe };
  }, [filtered]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(filtered.map((r) => ({
      Tanggal: dfmt(r.tanggal), Tipe: r.tipe, Anggota: r.anggota, Keterangan: r.keterangan,
      Nominal: r.nominal, Status: r.status, "Bukti URL": r.bukti_url ?? "", Ref: r.id,
    })));
    XLSX.utils.book_append_sheet(wb, sheet, "Arsip Transaksi");
    XLSX.writeFile(wb, `Arsip-Transaksi-${from}_${to}.xlsx`);
    toast.success("Arsip transaksi diunduh");
  };

  const openBukti = async (r: Row) => {
    if (!r.bukti_url) return;
    // Already a full URL (public bucket / external) — open directly.
    if (/^https?:\/\//i.test(r.bukti_url)) {
      window.open(r.bukti_url, "_blank", "noopener,noreferrer");
      return;
    }
    const bucket = r.bukti_bucket ?? "bukti-transfer";
    const url = await getSignedUrl(bucket, r.bukti_url, 3600);
    if (!url) {
      toast.error("Gagal membuka bukti. File mungkin tidak ditemukan.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isPengurus) return <Card className="p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><p className="mt-2 text-sm">Akses khusus pengurus.</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-[#312b2b]"><Archive className="h-4 w-4" /> E-Ledger</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[#2c2626]">Arsip Digital Transaksi</h1>
        <p className="mt-1 text-sm text-[#3e3232]">Pusat arsip semua transaksi koperasi: simpanan, pinjaman, angsuran, SHU, dan marketplace — lengkap dengan bukti digital.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div><Label className="text-xs">Dari</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Sampai</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <div className="w-44">
            <Label className="text-xs">Tipe</Label>
            <Select value={tipe} onValueChange={(v: any) => setTipe(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua tipe</SelectItem>
                <SelectItem value="simpanan">Simpanan</SelectItem>
                <SelectItem value="angsuran">Angsuran</SelectItem>
                <SelectItem value="pinjaman">Pinjaman</SelectItem>
                <SelectItem value="shu">SHU</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]"><Label className="text-xs">Cari</Label><Input placeholder="Anggota / keterangan / status..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button onClick={exportXlsx} disabled={!filtered.length}><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total Transaksi</p><p className="mt-1 text-lg font-bold">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Dengan Bukti Digital</p><p className="mt-1 text-lg font-bold text-success">{stats.withBukti}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Tanpa Bukti</p><p className="mt-1 text-lg font-bold text-destructive">{stats.total - stats.withBukti}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">Daftar Arsip</CardTitle></CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada transaksi pada filter ini.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Anggota</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bukti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((r) => (
                  <TableRow key={`${r.tipe}-${r.id}`}>
                    <TableCell className="whitespace-nowrap text-xs">{dfmt(r.tanggal)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.tipe}</Badge></TableCell>
                    <TableCell className="text-xs">{r.anggota}</TableCell>
                    <TableCell className="text-xs">{r.keterangan}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt.format(r.nominal)}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{r.status}</Badge></TableCell>
                    <TableCell>
                      {r.bukti_url ? (
                        <button type="button" onClick={() => openBukti(r)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Paperclip className="h-3 w-3" /> Lihat <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 500 && (
            <div className="border-t p-3 text-center text-xs text-muted-foreground">Menampilkan 500 dari {filtered.length} arsip. Persempit filter atau export untuk melihat semua.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}