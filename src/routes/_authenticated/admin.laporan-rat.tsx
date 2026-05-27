import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Gavel, Users, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { buildSignedReportPdf } from "@/lib/report-pdf";

export const Route = createFileRoute("/_authenticated/admin/laporan-rat")({
  head: () => ({ meta: [{ title: "Laporan RAT Tahunan — Admin" }] }),
  component: AdminLaporanRAT,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function AdminLaporanRAT() {
  const { user, roles, profile } = useAuth();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const isKetua = roles.some((r) => ["super_admin", "ketua"].includes(r));

  const currentYear = new Date().getFullYear();
  const [tahun, setTahun] = useState<number>(currentYear);

  const startISO = `${tahun}-01-01T00:00:00`;
  const endISO = `${tahun}-12-31T23:59:59`;

  const { data, isLoading } = useQuery({
    queryKey: ["laporan-rat", tahun],
    enabled: isPengurus,
    queryFn: async () => {
      const [
        { data: profiles },
        { data: simp },
        { data: pj },
        { data: ang },
        { data: shu },
        { data: meetings },
        { data: mp },
      ] = await Promise.all([
        supabase.from("profiles").select("id,status,joined_at,deleted_at,nomor_anggota,nama_lengkap"),
        supabase.from("simpanan").select("nominal,jenis,status,created_at").eq("status", "verified").gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("pinjaman").select("nominal,total_bayar,status,disbursed_at,created_at").gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("angsuran").select("nominal,denda,status,paid_at").eq("status", "paid").gte("paid_at", startISO).lte("paid_at", endISO),
        supabase.from("shu").select("nominal,user_id,tahun,dibagikan_at").eq("tahun", tahun),
        supabase.from("meetings").select("id,judul,mulai,status").gte("mulai", startISO).lte("mulai", endISO),
        supabase.from("marketplace_transactions").select("total,fee_nominal,status,received_at").eq("status", "completed").gte("received_at", startISO).lte("received_at", endISO),
      ]);

      const startYearDate = new Date(startISO);
      const endYearDate = new Date(endISO);

      const anggotaAwal = (profiles ?? []).filter((p) => new Date(p.joined_at) < startYearDate && (!p.deleted_at || new Date(p.deleted_at) >= startYearDate)).length;
      const anggotaMasuk = (profiles ?? []).filter((p) => {
        const j = new Date(p.joined_at);
        return j >= startYearDate && j <= endYearDate;
      }).length;
      const anggotaKeluar = (profiles ?? []).filter((p) => {
        if (!p.deleted_at) return false;
        const d = new Date(p.deleted_at);
        return d >= startYearDate && d <= endYearDate;
      }).length;
      const anggotaAkhir = anggotaAwal + anggotaMasuk - anggotaKeluar;
      const anggotaAktif = (profiles ?? []).filter((p) => p.status === "active" && !p.deleted_at).length;

      const perJenis = new Map<string, number>();
      (simp ?? []).forEach((s) => perJenis.set(s.jenis, (perJenis.get(s.jenis) ?? 0) + Number(s.nominal)));

      const totalSimpanan = (simp ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalPinjaman = (pj ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalAngsuran = (ang ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalDenda = (ang ?? []).reduce((a, b) => a + Number(b.denda ?? 0), 0);
      const totalShu = (shu ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const pendapatanBunga = (pj ?? []).reduce((a, b) => a + Math.max(0, Number(b.total_bayar ?? 0) - Number(b.nominal ?? 0)), 0);
      const feeMarketplace = (mp ?? []).reduce((a, b) => a + Number(b.fee_nominal ?? 0), 0);
      const gmvMarketplace = (mp ?? []).reduce((a, b) => a + Number(b.total ?? 0), 0);

      const totalPendapatan = pendapatanBunga + totalDenda + feeMarketplace;
      const totalBeban = totalShu;
      const labaBersih = totalPendapatan - totalBeban;

      const kasMasuk = totalSimpanan + totalAngsuran + totalDenda + feeMarketplace;
      const kasKeluar = totalPinjaman + totalShu;
      const saldoBersih = kasMasuk - kasKeluar;

      const pinjamanBeredar = Math.max(0, totalPinjaman - totalAngsuran);

      const rapatList = (meetings ?? []).map((m) => ({
        id: m.id,
        judul: m.judul,
        mulai: m.mulai,
        status: m.status,
      }));

      return {
        anggota: { awal: anggotaAwal, masuk: anggotaMasuk, keluar: anggotaKeluar, akhir: anggotaAkhir, aktif: anggotaAktif },
        keuangan: {
          totalSimpanan, totalPinjaman, totalAngsuran, totalDenda, totalShu,
          pendapatanBunga, feeMarketplace, gmvMarketplace,
          totalPendapatan, totalBeban, labaBersih,
          kasMasuk, kasKeluar, saldoBersih, pinjamanBeredar,
        },
        perJenis: Array.from(perJenis.entries()).map(([jenis, total]) => ({ jenis, total })),
        rapat: rapatList,
        shuPerAnggota: (shu ?? []).length,
      };
    },
  });

  const tahunOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 6; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Bagian: "Tahun Buku", Nilai: tahun },
      { Bagian: "Anggota Awal", Nilai: data.anggota.awal },
      { Bagian: "Anggota Masuk", Nilai: data.anggota.masuk },
      { Bagian: "Anggota Keluar", Nilai: data.anggota.keluar },
      { Bagian: "Anggota Akhir", Nilai: data.anggota.akhir },
      { Bagian: "Anggota Aktif", Nilai: data.anggota.aktif },
    ]), "Anggota");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Item: "Total Simpanan", Nilai: data.keuangan.totalSimpanan },
      { Item: "Total Pinjaman Disalurkan", Nilai: data.keuangan.totalPinjaman },
      { Item: "Total Angsuran Diterima", Nilai: data.keuangan.totalAngsuran },
      { Item: "Pinjaman Beredar", Nilai: data.keuangan.pinjamanBeredar },
      { Item: "Pendapatan Bunga", Nilai: data.keuangan.pendapatanBunga },
      { Item: "Pendapatan Denda", Nilai: data.keuangan.totalDenda },
      { Item: "Fee Marketplace", Nilai: data.keuangan.feeMarketplace },
      { Item: "GMV Marketplace", Nilai: data.keuangan.gmvMarketplace },
      { Item: "Total Pendapatan", Nilai: data.keuangan.totalPendapatan },
      { Item: "Total Beban (SHU)", Nilai: data.keuangan.totalBeban },
      { Item: "LABA BERSIH", Nilai: data.keuangan.labaBersih },
      { Item: "Kas Masuk", Nilai: data.keuangan.kasMasuk },
      { Item: "Kas Keluar", Nilai: data.keuangan.kasKeluar },
      { Item: "Saldo Bersih", Nilai: data.keuangan.saldoBersih },
    ]), "Keuangan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.perJenis.map((j) => ({ Jenis: j.jenis, Total: j.total }))), "Simpanan per Jenis");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rapat.map((r) => ({ Judul: r.judul, Mulai: r.mulai, Status: r.status }))), "Rapat");
    XLSX.writeFile(wb, `RAT-${tahun}.xlsx`);
    toast.success("Laporan RAT (Excel) berhasil diunduh");
  };

  const exportPDF = async (sig?: SignatureResult) => {
    if (!data) return;
    const verifyId = `RAT-${tahun}-${Date.now()}`;
    const sections = [
      { title: "Dinamika Keanggotaan", head: ["Item", "Jumlah"], body: [
        ["Anggota Awal Tahun", String(data.anggota.awal)],
        ["Anggota Masuk", String(data.anggota.masuk)],
        ["Anggota Keluar", String(data.anggota.keluar)],
        ["Anggota Akhir Tahun", String(data.anggota.akhir)],
        ["Anggota Aktif (saat ini)", String(data.anggota.aktif)],
      ] },
      { title: "Arus Kas Tahunan", head: ["Item", "Nilai"], body: [
        ["Kas Masuk", fmt(data.keuangan.kasMasuk)],
        ["  Simpanan", fmt(data.keuangan.totalSimpanan)],
        ["  Angsuran", fmt(data.keuangan.totalAngsuran)],
        ["  Denda", fmt(data.keuangan.totalDenda)],
        ["  Fee Marketplace", fmt(data.keuangan.feeMarketplace)],
        ["Kas Keluar", fmt(data.keuangan.kasKeluar)],
        ["  Pinjaman Disalurkan", fmt(data.keuangan.totalPinjaman)],
        ["  SHU Dibagikan", fmt(data.keuangan.totalShu)],
        ["SALDO BERSIH", fmt(data.keuangan.saldoBersih)],
      ] },
      { title: "Laporan Laba Rugi", head: ["Item", "Nilai"], body: [
        ["Pendapatan Bunga Pinjaman", fmt(data.keuangan.pendapatanBunga)],
        ["Pendapatan Denda", fmt(data.keuangan.totalDenda)],
        ["Pendapatan Fee Marketplace", fmt(data.keuangan.feeMarketplace)],
        ["Total Pendapatan", fmt(data.keuangan.totalPendapatan)],
        ["Beban SHU", fmt(data.keuangan.totalBeban)],
        ["LABA BERSIH", fmt(data.keuangan.labaBersih)],
      ] },
      { title: "Komposisi Simpanan per Jenis", head: ["Jenis", "Total"], body: data.perJenis.map((j) => [j.jenis, fmt(j.total)]) },
      { title: "Rapat Sepanjang Tahun", head: ["Judul", "Tanggal", "Status"], body: data.rapat.map((r) => [r.judul, new Date(r.mulai).toLocaleDateString("id-ID"), r.status]) },
    ];

    const doc = await buildSignedReportPdf({
      title: `LAPORAN PERTANGGUNGJAWABAN PENGURUS — RAT TAHUN ${tahun}`,
      subtitle: "Koperasi T-COOL",
      period: `1 Januari ${tahun} s/d 31 Desember ${tahun}`,
      sections,
      signatures: [
        { role: "Bendahara", name: profile?.nama_lengkap ?? "—" },
        { role: "Sekretaris", name: "—" },
        { role: "Ketua", name: sig?.fullName ?? "—", dataUrl: sig?.dataUrl },
      ],
      verifyId,
    });
    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null, action: "laporan_rat.exported", entity: "laporan_rat",
      new_data: { verifyId, tahun, signed: !!sig },
    });
    doc.save(`RAT-${tahun}.pdf`);
    toast.success("Laporan RAT (PDF) berhasil diunduh");
  };

  if (!isPengurus) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">Hanya pengurus yang dapat mengakses Laporan RAT.</div>;
  }

  const k = data?.keuangan;
  const a = data?.anggota;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-[#312b2b]"><Gavel className="h-4 w-4" /> Laporan Pertanggungjawaban RAT</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[#2c2626]">Laporan RAT Tahunan</h1>
        <p className="mt-1 text-sm text-[#3e3232]">Ringkasan keanggotaan, arus kas, laba rugi, dan kegiatan untuk Rapat Anggota Tahunan.</p>
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="space-y-1">
            <Label htmlFor="tahun">Tahun Buku</Label>
            <select
              id="tahun"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
            >
              {tahunOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportExcel} disabled={!data}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />Unduh Excel
            </Button>
            <Button variant="outline" onClick={() => exportPDF()} disabled={!data}>
              <FileText className="mr-2 h-4 w-4" />Unduh PDF
            </Button>
            {isKetua && (
              <SignaturePadDialog
                title="Tanda Tangani Laporan RAT"
                onSign={(s) => exportPDF(s)}
                trigger={<Button disabled={!data}><FileText className="mr-2 h-4 w-4" />PDF + TTD Ketua</Button>}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<Users className="h-4 w-4" />} label="Anggota Akhir" value={String(a!.akhir)} sub={`+${a!.masuk} masuk · -${a!.keluar} keluar`} />
            <KpiCard icon={<Wallet className="h-4 w-4" />} label="Saldo Bersih" value={fmt(k!.saldoBersih)} sub={`Kas masuk ${fmt(k!.kasMasuk)}`} />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Laba Bersih" value={fmt(k!.labaBersih)} sub={`Pendapatan ${fmt(k!.totalPendapatan)}`} accent={k!.labaBersih >= 0} />
            <KpiCard icon={<Wallet className="h-4 w-4" />} label="Pinjaman Beredar" value={fmt(k!.pinjamanBeredar)} sub={`Disalurkan ${fmt(k!.totalPinjaman)}`} />
          </div>

          <Tabs defaultValue="keuangan">
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="keuangan">Keuangan</TabsTrigger>
              <TabsTrigger value="anggota">Anggota</TabsTrigger>
              <TabsTrigger value="rapat">Rapat</TabsTrigger>
            </TabsList>

            <TabsContent value="keuangan" className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader><CardTitle className="text-base">Arus Kas</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <Row label="Simpanan" value={k!.totalSimpanan} />
                      <Row label="Angsuran" value={k!.totalAngsuran} />
                      <Row label="Denda" value={k!.totalDenda} />
                      <Row label="Fee Marketplace" value={k!.feeMarketplace} />
                      <Row label="Total Kas Masuk" value={k!.kasMasuk} bold />
                      <Row label="Pinjaman Disalurkan" value={-k!.totalPinjaman} />
                      <Row label="SHU Dibagikan" value={-k!.totalShu} />
                      <Row label="Total Kas Keluar" value={-k!.kasKeluar} bold />
                      <Row label="SALDO BERSIH" value={k!.saldoBersih} bold accent={k!.saldoBersih >= 0} />
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader><CardTitle className="text-base">Laba Rugi</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <Row label="Pendapatan Bunga" value={k!.pendapatanBunga} />
                      <Row label="Pendapatan Denda" value={k!.totalDenda} />
                      <Row label="Pendapatan Fee Marketplace" value={k!.feeMarketplace} />
                      <Row label="Total Pendapatan" value={k!.totalPendapatan} bold />
                      <Row label="Beban SHU" value={-k!.totalBeban} />
                      <Row label="LABA BERSIH" value={k!.labaBersih} bold accent={k!.labaBersih >= 0} />
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card style={{ boxShadow: "var(--shadow-card)" }} className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Komposisi Simpanan per Jenis</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jenis</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.perJenis.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground">Belum ada data simpanan terverifikasi.</TableCell></TableRow>
                      )}
                      {data.perJenis.map((j) => (
                        <TableRow key={j.jenis}>
                          <TableCell className="capitalize">{j.jenis}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(j.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="anggota" className="mt-4">
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader><CardTitle className="text-base">Dinamika Keanggotaan</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell>Anggota Awal Tahun</TableCell><TableCell className="text-right tabular-nums">{a!.awal}</TableCell></TableRow>
                      <TableRow><TableCell>Anggota Masuk</TableCell><TableCell className="text-right tabular-nums text-green-600">+{a!.masuk}</TableCell></TableRow>
                      <TableRow><TableCell>Anggota Keluar</TableCell><TableCell className="text-right tabular-nums text-destructive">-{a!.keluar}</TableCell></TableRow>
                      <TableRow className="font-semibold"><TableCell>Anggota Akhir Tahun</TableCell><TableCell className="text-right tabular-nums">{a!.akhir}</TableCell></TableRow>
                      <TableRow><TableCell>Anggota Aktif (saat ini)</TableCell><TableCell className="text-right tabular-nums">{a!.aktif}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rapat" className="mt-4">
              <Card style={{ boxShadow: "var(--shadow-card)" }}>
                <CardHeader><CardTitle className="text-base">Rapat Tahun {tahun}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Judul</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rapat.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Belum ada rapat di tahun {tahun}. <Link to="/rapat" className="underline">Buat rapat</Link></TableCell></TableRow>
                      )}
                      {data.rapat.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.judul}</TableCell>
                          <TableCell>{new Date(r.mulai).toLocaleDateString("id-ID")}</TableCell>
                          <TableCell className="capitalize">{r.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card style={{ boxShadow: "var(--shadow-card)" }}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${accent === false ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: boolean }) {
  return (
    <TableRow className={bold ? "font-semibold" : ""}>
      <TableCell>{label}</TableCell>
      <TableCell className={`text-right tabular-nums ${value < 0 ? "text-destructive" : accent ? "text-green-600" : ""}`}>{fmt(value)}</TableCell>
    </TableRow>
  );
}
