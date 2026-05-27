import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import { FileBarChart2, FileSpreadsheet, FileText, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { buildSignedReportPdf } from "@/lib/report-pdf";
import { supabase as sb } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/laporan")({
  head: () => ({ meta: [{ title: "Laporan Keuangan — Admin" }] }),
  component: AdminLaporan,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const monthLabel = (k: string) => new Date(k + "-01").toLocaleDateString("id-ID", { month: "short", year: "2-digit" });

function AdminLaporan() {
  const { user, roles, profile } = useAuth();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const isKetua = roles.some((r) => ["super_admin", "ketua"].includes(r));

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().slice(0, 10);
  const defaultEnd = today.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const { data, isLoading } = useQuery({
    queryKey: ["laporan", startDate, endDate],
    enabled: isPengurus,
    queryFn: async () => {
      const startISO = `${startDate}T00:00:00`;
      const endISO = `${endDate}T23:59:59`;
      const [{ data: simp }, { data: pj }, { data: ang }, { data: shu }] = await Promise.all([
        supabase.from("simpanan").select("nominal,jenis,status,created_at").eq("status", "verified").gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("pinjaman").select("nominal,total_bayar,status,disbursed_at,created_at").in("status", ["disbursed", "completed", "approved"]).gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("angsuran").select("nominal,status,paid_at").eq("status", "paid").gte("paid_at", startISO).lte("paid_at", endISO),
        supabase.from("shu").select("nominal,dibagikan_at,tahun").gte("dibagikan_at", startISO).lte("dibagikan_at", endISO),
      ]);

      // Monthly aggregation
      const months = new Map<string, { month: string; simpanan: number; pinjaman: number; angsuran: number; shu: number }>();
      const ensure = (k: string) => {
        if (!months.has(k)) months.set(k, { month: k, simpanan: 0, pinjaman: 0, angsuran: 0, shu: 0 });
        return months.get(k)!;
      };
      (simp ?? []).forEach((s) => { ensure(s.created_at.slice(0, 7)).simpanan += Number(s.nominal); });
      (pj ?? []).forEach((p) => { ensure((p.disbursed_at ?? p.created_at).slice(0, 7)).pinjaman += Number(p.nominal); });
      (ang ?? []).forEach((a) => { if (a.paid_at) ensure(a.paid_at.slice(0, 7)).angsuran += Number(a.nominal); });
      (shu ?? []).forEach((s) => { if (s.dibagikan_at) ensure(s.dibagikan_at.slice(0, 7)).shu += Number(s.nominal); });

      const totalSimpanan = (simp ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalPinjaman = (pj ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalAngsuran = (ang ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalShu = (shu ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const bunga = (pj ?? []).reduce((a, b) => a + Math.max(0, Number(b.total_bayar ?? 0) - Number(b.nominal ?? 0)), 0);

      // Simpanan per jenis
      const perJenis = new Map<string, number>();
      (simp ?? []).forEach((s) => perJenis.set(s.jenis, (perJenis.get(s.jenis) ?? 0) + Number(s.nominal)));

      const monthList = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, label: monthLabel(m.month) }));
      const jenisList = Array.from(perJenis.entries()).map(([jenis, total]) => ({ jenis, total }));

      return { monthList, jenisList, totals: { totalSimpanan, totalPinjaman, totalAngsuran, totalShu, bunga, kasMasuk: totalSimpanan + totalAngsuran, kasKeluar: totalPinjaman + totalShu } };
    },
  });

  const summary = data?.totals;
  const cashflow = useMemo(() => (summary ? (summary.kasMasuk - summary.kasKeluar) : 0), [summary]);

  // Neraca & Laba Rugi derivation
  const neraca = useMemo(() => {
    if (!summary) return null;
    const kasBank = summary.kasMasuk - summary.kasKeluar;
    const pinjamanBeredar = Math.max(0, summary.totalPinjaman - summary.totalAngsuran);
    const totalAset = kasBank + pinjamanBeredar;
    const simpananAnggota = summary.totalSimpanan;
    const labaBerjalan = summary.bunga - summary.totalShu;
    const totalKewajibanEkuitas = simpananAnggota + labaBerjalan;
    return { kasBank, pinjamanBeredar, totalAset, simpananAnggota, labaBerjalan, totalKewajibanEkuitas };
  }, [summary]);

  const labaRugi = useMemo(() => {
    if (!summary) return null;
    const pendapatanBunga = summary.bunga;
    const totalPendapatan = pendapatanBunga;
    const bebanShu = summary.totalShu;
    const totalBeban = bebanShu;
    const labaBersih = totalPendapatan - totalBeban;
    return { pendapatanBunga, totalPendapatan, bebanShu, totalBeban, labaBersih };
  }, [summary]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet([
      { Metrik: "Periode", Nilai: `${startDate} s/d ${endDate}` },
      { Metrik: "Total Simpanan Masuk", Nilai: summary!.totalSimpanan },
      { Metrik: "Total Angsuran Masuk", Nilai: summary!.totalAngsuran },
      { Metrik: "Total Pinjaman Disalurkan", Nilai: summary!.totalPinjaman },
      { Metrik: "Total SHU Dibagikan", Nilai: summary!.totalShu },
      { Metrik: "Pendapatan Bunga", Nilai: summary!.bunga },
      { Metrik: "Kas Masuk", Nilai: summary!.kasMasuk },
      { Metrik: "Kas Keluar", Nilai: summary!.kasKeluar },
      { Metrik: "Saldo Bersih", Nilai: summary!.kasMasuk - summary!.kasKeluar },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.monthList.map((m) => ({ Bulan: m.label, Simpanan: m.simpanan, Pinjaman: m.pinjaman, Angsuran: m.angsuran, SHU: m.shu }))), "Per Bulan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.jenisList.map((j) => ({ Jenis: j.jenis, Total: j.total }))), "Simpanan per Jenis");
    if (neraca) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Pos: "ASET", Sub: "Kas & Bank", Nilai: neraca.kasBank },
      { Pos: "ASET", Sub: "Pinjaman Beredar", Nilai: neraca.pinjamanBeredar },
      { Pos: "ASET", Sub: "Total Aset", Nilai: neraca.totalAset },
      { Pos: "KEWAJIBAN", Sub: "Simpanan Anggota", Nilai: neraca.simpananAnggota },
      { Pos: "EKUITAS", Sub: "Laba Berjalan", Nilai: neraca.labaBerjalan },
      { Pos: "TOTAL", Sub: "Kewajiban + Ekuitas", Nilai: neraca.totalKewajibanEkuitas },
    ]), "Neraca");
    if (labaRugi) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Item: "Pendapatan Bunga", Nilai: labaRugi.pendapatanBunga },
      { Item: "Total Pendapatan", Nilai: labaRugi.totalPendapatan },
      { Item: "Beban SHU", Nilai: labaRugi.bebanShu },
      { Item: "Total Beban", Nilai: labaRugi.totalBeban },
      { Item: "Laba Bersih", Nilai: labaRugi.labaBersih },
    ]), "Laba Rugi");
    XLSX.writeFile(wb, `Laporan-Koperasi-${startDate}_${endDate}.xlsx`);
    toast.success("Laporan Excel berhasil diunduh");
  };

  const exportPDF = async (sig?: SignatureResult) => {
    if (!data || !summary) return;
    const verifyId = `LAP-${startDate}-${endDate}-${Date.now()}`;
    const sections = [
      { title: "Ringkasan Arus Kas", head: ["Item", "Nilai"], body: [
        ["Total Simpanan Masuk", fmt(summary.totalSimpanan)],
        ["Total Angsuran Masuk", fmt(summary.totalAngsuran)],
        ["Total Pinjaman Disalurkan", fmt(summary.totalPinjaman)],
        ["Total SHU Dibagikan", fmt(summary.totalShu)],
        ["Pendapatan Bunga", fmt(summary.bunga)],
        ["Kas Masuk", fmt(summary.kasMasuk)],
        ["Kas Keluar", fmt(summary.kasKeluar)],
        ["Saldo Bersih", fmt(summary.kasMasuk - summary.kasKeluar)],
      ] },
    ];
    if (neraca) sections.push({ title: "Neraca", head: ["Pos", "Nilai"], body: [
      ["Kas & Bank", fmt(neraca.kasBank)],
      ["Pinjaman Beredar", fmt(neraca.pinjamanBeredar)],
      ["TOTAL ASET", fmt(neraca.totalAset)],
      ["Simpanan Anggota (Kewajiban)", fmt(neraca.simpananAnggota)],
      ["Laba Berjalan (Ekuitas)", fmt(neraca.labaBerjalan)],
      ["TOTAL KEWAJIBAN + EKUITAS", fmt(neraca.totalKewajibanEkuitas)],
    ] });
    if (labaRugi) sections.push({ title: "Laporan Laba Rugi", head: ["Item", "Nilai"], body: [
      ["Pendapatan Bunga", fmt(labaRugi.pendapatanBunga)],
      ["Total Pendapatan", fmt(labaRugi.totalPendapatan)],
      ["Beban SHU", fmt(labaRugi.bebanShu)],
      ["Total Beban", fmt(labaRugi.totalBeban)],
      ["LABA BERSIH", fmt(labaRugi.labaBersih)],
    ] });
    sections.push({ title: "Detail per Bulan", head: ["Bulan", "Simpanan", "Pinjaman", "Angsuran", "SHU"], body: data.monthList.map((m) => [m.label, fmt(m.simpanan), fmt(m.pinjaman), fmt(m.angsuran), fmt(m.shu)]) });

    const doc = await buildSignedReportPdf({
      title: "Laporan Keuangan Koperasi",
      period: `${startDate} s/d ${endDate}`,
      sections,
      signatures: [
        { role: "Bendahara", name: profile?.nama_lengkap ?? "—" },
        { role: "Ketua", name: sig?.fullName ?? "—", dataUrl: sig?.dataUrl },
      ],
      verifyId,
    });
    await sb.from("audit_logs").insert({ actor_id: user?.id ?? null, action: "laporan.exported", entity: "laporan", new_data: { verifyId, periode: `${startDate}/${endDate}`, signed: !!sig } });
    doc.save(`Laporan-Koperasi-${startDate}_${endDate}.pdf`);
    toast.success("Laporan PDF berhasil diunduh");
  };

  if (!isPengurus) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">Hanya pengurus yang dapat mengakses laporan keuangan.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-[#312b2b]"><FileBarChart2 className="h-4 w-4" /> Laporan Keuangan</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[#2c2626]">Ringkasan Arus Kas Koperasi</h1>
        <p className="mt-1 text-sm text-[#3e3232]">Pilih periode, lihat grafik, dan unduh laporan dalam format PDF atau Excel.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs">Dari Tanggal</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" /></div>
            <div><Label className="text-xs">Sampai Tanggal</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportPDF()} disabled={!data || isLoading}><FileText className="mr-2 h-4 w-4" /> Export PDF</Button>
            {isKetua && (
              <SignaturePadDialog
                title="Tanda Tangani Laporan Keuangan"
                onSign={(s) => exportPDF(s)}
                trigger={<Button variant="secondary" disabled={!data || isLoading}><ShieldCheck className="mr-2 h-4 w-4" /> PDF + TTD Ketua</Button>}
              />
            )}
            <Button onClick={exportExcel} disabled={!data || isLoading}><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Kpi label="Kas Masuk" value={summary.kasMasuk} positive />
            <Kpi label="Kas Keluar" value={summary.kasKeluar} />
            <Kpi label="Pendapatan Bunga" value={summary.bunga} positive />
            <Kpi label="Saldo Bersih" value={cashflow} positive={cashflow >= 0} />
          </>
        )}
      </div>

      <Tabs defaultValue="arus">
        <TabsList>
          <TabsTrigger value="arus">Arus Kas</TabsTrigger>
          <TabsTrigger value="neraca">Neraca</TabsTrigger>
          <TabsTrigger value="labarugi">Laba Rugi</TabsTrigger>
        </TabsList>

        <TabsContent value="arus" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Arus Kas per Bulan</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {isLoading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.monthList ?? []}>
                    <defs>
                      <linearGradient id="grIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient>
                      <linearGradient id="grOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="simpanan" name="Simpanan" stroke="hsl(var(--success))" fill="url(#grIn)" />
                    <Area type="monotone" dataKey="angsuran" name="Angsuran" stroke="hsl(var(--primary))" fillOpacity={0} />
                    <Area type="monotone" dataKey="pinjaman" name="Pinjaman" stroke="hsl(var(--destructive))" fill="url(#grOut)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Simpanan per Jenis</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {isLoading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.jenisList ?? []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="jenis" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="neraca" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Neraca per {endDate}</CardTitle></CardHeader>
            <CardContent>
              {!neraca ? <Skeleton className="h-40 w-full" /> : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Aset</h3>
                    <NeracaRow label="Kas & Bank" value={neraca.kasBank} />
                    <NeracaRow label="Pinjaman Beredar" value={neraca.pinjamanBeredar} />
                    <div className="border-t pt-2"><NeracaRow label="Total Aset" value={neraca.totalAset} bold /></div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Kewajiban & Ekuitas</h3>
                    <NeracaRow label="Simpanan Anggota" value={neraca.simpananAnggota} />
                    <NeracaRow label="Laba Berjalan" value={neraca.labaBerjalan} />
                    <div className="border-t pt-2"><NeracaRow label="Total Kewajiban + Ekuitas" value={neraca.totalKewajibanEkuitas} bold /></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labarugi" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Laporan Laba Rugi · {startDate} s/d {endDate}</CardTitle></CardHeader>
            <CardContent>
              {!labaRugi ? <Skeleton className="h-40 w-full" /> : (
                <div className="space-y-2 text-sm">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Pendapatan</h3>
                  <NeracaRow label="Pendapatan Bunga" value={labaRugi.pendapatanBunga} />
                  <div className="border-t pt-2"><NeracaRow label="Total Pendapatan" value={labaRugi.totalPendapatan} bold /></div>
                  <h3 className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Beban</h3>
                  <NeracaRow label="Beban SHU Dibagikan" value={labaRugi.bebanShu} />
                  <div className="border-t pt-2"><NeracaRow label="Total Beban" value={labaRugi.totalBeban} bold /></div>
                  <div className="mt-4 rounded-xl bg-primary/10 p-4">
                    <NeracaRow label="LABA BERSIH" value={labaRugi.labaBersih} bold highlight />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Detail per Bulan</span>
            <Badge variant="secondary">{data?.monthList.length ?? 0} bulan</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead className="text-right">Simpanan</TableHead>
                <TableHead className="text-right">Pinjaman</TableHead>
                <TableHead className="text-right">Angsuran</TableHead>
                <TableHead className="text-right">SHU</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data?.monthList ?? []).map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right">{fmt(m.simpanan)}</TableCell>
                    <TableCell className="text-right">{fmt(m.pinjaman)}</TableCell>
                    <TableCell className="text-right">{fmt(m.angsuran)}</TableCell>
                    <TableCell className="text-right">{fmt(m.shu)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={positive ? "h-4 w-4 text-success" : "h-4 w-4 text-destructive"} />
        </div>
        <p className="mt-2 text-2xl font-bold">{fmt(value)}</p>
      </CardContent>
    </Card>
  );
}

function NeracaRow({ label, value, bold, highlight }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? "font-bold" : ""} ${highlight ? "text-lg text-primary" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  );
}
