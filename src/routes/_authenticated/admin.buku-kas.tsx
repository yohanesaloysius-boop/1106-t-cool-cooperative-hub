import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookText, Loader2, ShieldAlert, FileSpreadsheet, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/buku-kas")({
  head: () => ({ meta: [{ title: "Buku Kas — Admin" }] }),
  component: AdminBukuKas,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Row = {
  tanggal: string;
  jenis: string;
  keterangan: string;
  arah: "in" | "out";
  nominal: number;
  ref_table: string;
  ref_id: string;
};

function AdminBukuKas() {
  const { isPengurus, loading } = useAuth();
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [arah, setArah] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["buku-kas", from, to],
    enabled: isPengurus,
    queryFn: async () => {
      const fromISO = `${from}T00:00:00`;
      const toISO = `${to}T23:59:59`;
      const [{ data: simp }, { data: ang }, { data: pj }, { data: shu }] = await Promise.all([
        supabase.from("simpanan").select("id,nominal,jenis,created_at,user_id,profiles:profiles!simpanan_user_id_fkey(nama_lengkap,nomor_anggota)").eq("status", "verified").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("angsuran").select("id,nominal,paid_at,cicilan_ke,user_id,profiles:profiles!angsuran_user_id_fkey(nama_lengkap,nomor_anggota)").eq("status", "paid").gte("paid_at", fromISO).lte("paid_at", toISO),
        supabase.from("pinjaman").select("id,nominal,disbursed_at,user_id,profiles:profiles!pinjaman_user_id_fkey(nama_lengkap,nomor_anggota)").not("disbursed_at", "is", null).gte("disbursed_at", fromISO).lte("disbursed_at", toISO),
        supabase.from("shu").select("id,nominal,dibagikan_at,tahun,user_id,profiles:profiles!shu_user_id_fkey(nama_lengkap,nomor_anggota)").not("dibagikan_at", "is", null).gte("dibagikan_at", fromISO).lte("dibagikan_at", toISO),
      ]);
      const rows: Row[] = [];
      const name = (p: any) => p ? `${p.nama_lengkap}${p.nomor_anggota ? ` (${p.nomor_anggota})` : ""}` : "-";
      (simp ?? []).forEach((s: any) => rows.push({ tanggal: s.created_at, jenis: `Simpanan ${s.jenis}`, keterangan: `Setoran simpanan dari ${name(s.profiles)}`, arah: "in", nominal: Number(s.nominal), ref_table: "simpanan", ref_id: s.id }));
      (ang ?? []).forEach((a: any) => rows.push({ tanggal: a.paid_at, jenis: "Angsuran", keterangan: `Pembayaran angsuran ke-${a.cicilan_ke} dari ${name(a.profiles)}`, arah: "in", nominal: Number(a.nominal), ref_table: "angsuran", ref_id: a.id }));
      (pj ?? []).forEach((p: any) => rows.push({ tanggal: p.disbursed_at, jenis: "Pencairan Pinjaman", keterangan: `Pencairan pinjaman kepada ${name(p.profiles)}`, arah: "out", nominal: Number(p.nominal), ref_table: "pinjaman", ref_id: p.id }));
      (shu ?? []).forEach((s: any) => rows.push({ tanggal: s.dibagikan_at, jenis: `SHU ${s.tahun}`, keterangan: `Pembagian SHU kepada ${name(s.profiles)}`, arah: "out", nominal: Number(s.nominal), ref_table: "shu", ref_id: s.id }));
      rows.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
      return rows;
    },
  });

  const filtered = useMemo(() => {
    const rows = (query.data ?? []).filter((r) => (arah === "all" || r.arah === arah) && (!q || r.keterangan.toLowerCase().includes(q.toLowerCase()) || r.jenis.toLowerCase().includes(q.toLowerCase())));
    let bal = 0; let tIn = 0; let tOut = 0;
    const withBal = rows.map((r) => {
      if (r.arah === "in") { bal += r.nominal; tIn += r.nominal; } else { bal -= r.nominal; tOut += r.nominal; }
      return { ...r, saldo: bal };
    });
    return { rows: withBal, totalIn: tIn, totalOut: tOut, saldo: bal };
  }, [query.data, arah, q]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(filtered.rows.map((r) => ({
      Tanggal: dfmt(r.tanggal), Jenis: r.jenis, Keterangan: r.keterangan,
      Masuk: r.arah === "in" ? r.nominal : 0, Keluar: r.arah === "out" ? r.nominal : 0, Saldo: r.saldo, Ref: `${r.ref_table}:${r.ref_id}`,
    })));
    XLSX.utils.book_append_sheet(wb, sheet, "Buku Kas");
    XLSX.writeFile(wb, `Buku-Kas-${from}_${to}.xlsx`);
    toast.success("Buku kas diunduh");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isPengurus) return <Card className="p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><p className="mt-2 text-sm">Akses khusus pengurus.</p></Card>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-white/80"><BookText className="h-4 w-4" /> Buku Kas Harian</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold">Jurnal Kas Koperasi</h1>
        <p className="mt-1 text-sm text-[#3e3232]">Catatan kronologis semua mutasi kas masuk dan keluar koperasi.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div><Label className="text-xs">Dari</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Sampai</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <div>
            <Label className="text-xs">Arah</Label>
            <div className="flex gap-1">
              {(["all", "in", "out"] as const).map((a) => (
                <Button key={a} type="button" size="sm" variant={arah === a ? "default" : "outline"} onClick={() => setArah(a)}>
                  {a === "all" ? "Semua" : a === "in" ? "Masuk" : "Keluar"}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]"><Label className="text-xs">Cari</Label><Input placeholder="Keterangan / jenis..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button onClick={exportXlsx} disabled={!filtered.rows.length}><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownToLine className="h-4 w-4 text-success" /> Total Kas Masuk</div><p className="mt-1 text-lg font-bold text-success">{fmt.format(filtered.totalIn)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpFromLine className="h-4 w-4 text-destructive" /> Total Kas Keluar</div><p className="mt-1 text-lg font-bold text-destructive">{fmt.format(filtered.totalOut)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" /> Saldo Akhir Periode</div><p className="mt-1 text-lg font-bold">{fmt.format(filtered.saldo)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">Mutasi Kas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : filtered.rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada mutasi pada periode ini.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Masuk</TableHead>
                  <TableHead className="text-right">Keluar</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.rows.map((r, i) => (
                  <TableRow key={`${r.ref_table}-${r.ref_id}-${i}`}>
                    <TableCell className="whitespace-nowrap text-xs">{dfmt(r.tanggal)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">{r.keterangan}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-success">{r.arah === "in" ? fmt.format(r.nominal) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-destructive">{r.arah === "out" ? fmt.format(r.nominal) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">{fmt.format(r.saldo)}</TableCell>
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