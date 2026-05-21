import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { FileBarChart2, FileSpreadsheet, Loader2, ShieldAlert } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/admin/laporan-sak")({
  head: () => ({ meta: [{ title: "Laporan SAK ETAP — Admin" }] }),
  component: LaporanSakPage,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function LaporanSakPage() {
  const { roles } = useAuth();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const defaultEnd = today.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const { data, isLoading } = useQuery({
    queryKey: ["sak-etap", startDate, endDate],
    enabled: isPengurus,
    queryFn: async () => {
      const startISO = `${startDate}T00:00:00`;
      const endISO = `${endDate}T23:59:59`;
      const [simpAll, pinjAll, angAll, opex, assets, deps, shu, walletTx] = await Promise.all([
        supabase.from("simpanan").select("nominal, jenis, status, created_at").eq("status", "verified"),
        supabase.from("pinjaman").select("nominal, total_bayar, status, disbursed_at, created_at"),
        supabase.from("angsuran").select("nominal, denda, status, paid_at, created_at"),
        supabase.from("opex_expenses").select("nominal, pajak_nominal, status, tanggal, category_id, opex_categories:category_id(nama, kode)").eq("status", "paid").gte("tanggal", startDate).lte("tanggal", endDate),
        supabase.from("assets").select("harga_perolehan, nilai_residu, status, tanggal_perolehan"),
        supabase.from("asset_depreciations").select("beban_bulan, akumulasi, periode").gte("periode", startDate).lte("periode", endDate),
        supabase.from("shu").select("nominal_total, periode, status"),
        supabase.from("wallet_transactions").select("nominal, arah, jenis, created_at"),
      ]);

      const sum = (arr: any[] | null, f: (x: any) => number) => (arr ?? []).reduce((s, x) => s + Number(f(x) || 0), 0);
      const inRange = (d: string) => d >= startDate && d <= endDate + "T23:59:59";

      // ASET
      const totalAsetTetap = sum(assets.data, (a) => a.harga_perolehan);
      const totalAkumDep = sum(deps.data, (d) => d.beban_bulan); // periode terpilih saja, kasar
      const nilaiBukuAset = Math.max(0, totalAsetTetap - sum(deps.data ?? [], (d) => d.akumulasi));

      const simpananMasuk = sum(simpAll.data?.filter((s: any) => inRange(s.created_at)), (s) => s.nominal);
      const pinjamanCair = sum(pinjAll.data?.filter((p: any) => p.disbursed_at && inRange(p.disbursed_at)), (p) => p.nominal);
      const angsuranMasuk = sum(angAll.data?.filter((a: any) => a.paid_at && inRange(a.paid_at)), (a) => a.nominal);
      const dendaMasuk = sum(angAll.data?.filter((a: any) => a.paid_at && inRange(a.paid_at)), (a) => a.denda);
      const opexTotal = sum(opex.data, (o) => o.nominal);
      const pajakTotal = sum(opex.data, (o) => o.pajak_nominal);

      // Estimasi kas: simpanan masuk + angsuran masuk - pinjaman cair - opex
      const kasAkhir = simpananMasuk + angsuranMasuk + dendaMasuk - pinjamanCair - opexTotal;

      // Saldo piutang anggota (pinjaman outstanding kasar)
      const pinjamanAktif = sum(
        pinjAll.data?.filter((p: any) => ["disbursed", "active", "overdue"].includes(p.status)),
        (p) => p.nominal,
      );
      const angsuranLunas = sum(angAll.data?.filter((a: any) => a.status === "paid"), (a) => a.nominal);
      const piutangAnggota = Math.max(0, pinjamanAktif - angsuranLunas);

      // Modal: total simpanan pokok + wajib (semua waktu)
      const simpananPokok = sum(simpAll.data?.filter((s: any) => s.jenis === "pokok"), (s) => s.nominal);
      const simpananWajib = sum(simpAll.data?.filter((s: any) => s.jenis === "wajib"), (s) => s.nominal);
      const simpananSukarela = sum(simpAll.data?.filter((s: any) => s.jenis === "sukarela"), (s) => s.nominal);

      // LABA RUGI
      const pendapatanBunga = Math.max(0, angsuranMasuk - (pinjamanCair > 0 ? pinjamanCair * 0 : 0)); // proxy: pendapatan dari jasa pinjaman
      // Lebih akurat: bunga = total_bayar - nominal pinjaman
      const totalBungaPinjamanPeriode = sum(
        pinjAll.data?.filter((p: any) => p.disbursed_at && inRange(p.disbursed_at)),
        (p) => (Number(p.total_bayar) || 0) - (Number(p.nominal) || 0),
      );
      const pendapatanOperasional = totalBungaPinjamanPeriode + dendaMasuk;
      const bebanOperasional = opexTotal;
      const bebanPenyusutan = sum(deps.data, (d) => d.beban_bulan);
      const labaSebelumPajak = pendapatanOperasional - bebanOperasional - bebanPenyusutan;
      const pajakPenghasilan = pajakTotal; // proxy
      const labaBersih = labaSebelumPajak - pajakPenghasilan;

      // ARUS KAS
      const kasOperasi = angsuranMasuk + dendaMasuk - opexTotal;
      const kasInvestasi = -totalAsetTetap; // pembelian aset (kasar)
      const kasPendanaan = simpananMasuk - pinjamanCair;

      // EKUITAS
      const totalSimpanan = simpananPokok + simpananWajib + simpananSukarela;
      const shuTotal = sum(shu.data, (s) => s.nominal_total);
      const ekuitasTotal = totalSimpanan + labaBersih;

      // NERACA
      const totalAset = kasAkhir + piutangAnggota + nilaiBukuAset;
      const totalLiabilitas = 0; // tidak ada tabel utang eksplisit
      const totalEkuitas = ekuitasTotal;

      return {
        simpananMasuk, pinjamanCair, angsuranMasuk, dendaMasuk, opexTotal, pajakTotal,
        kasAkhir, piutangAnggota, nilaiBukuAset, totalAsetTetap, totalAkumDep,
        simpananPokok, simpananWajib, simpananSukarela, totalSimpanan,
        pendapatanOperasional, bebanOperasional, bebanPenyusutan, labaSebelumPajak, pajakPenghasilan, labaBersih,
        kasOperasi, kasInvestasi, kasPendanaan,
        totalAset, totalLiabilitas, totalEkuitas, shuTotal,
        opexByCategory: aggregate(opex.data ?? [], (o: any) => o.opex_categories?.nama ?? "Lainnya", (o: any) => Number(o.nominal)),
      };
    },
  });

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const neraca = [
      ["NERACA - per " + endDate],
      [],
      ["ASET", ""],
      ["Kas & Setara Kas", data.kasAkhir],
      ["Piutang Anggota (Pinjaman)", data.piutangAnggota],
      ["Aset Tetap (nilai buku)", data.nilaiBukuAset],
      ["TOTAL ASET", data.totalAset],
      [],
      ["LIABILITAS & EKUITAS", ""],
      ["Total Liabilitas", data.totalLiabilitas],
      ["Simpanan Pokok", data.simpananPokok],
      ["Simpanan Wajib", data.simpananWajib],
      ["Simpanan Sukarela", data.simpananSukarela],
      ["Laba Tahun Berjalan", data.labaBersih],
      ["TOTAL EKUITAS", data.totalEkuitas],
      ["TOTAL LIABILITAS & EKUITAS", data.totalLiabilitas + data.totalEkuitas],
    ];
    const lr = [
      ["LAPORAN LABA RUGI", "", startDate + " s/d " + endDate],
      [],
      ["PENDAPATAN", ""],
      ["Pendapatan Jasa Pinjaman + Denda", data.pendapatanOperasional],
      [],
      ["BEBAN", ""],
      ["Beban Operasional (OPEX)", data.bebanOperasional],
      ["Beban Penyusutan", data.bebanPenyusutan],
      ["Total Beban", data.bebanOperasional + data.bebanPenyusutan],
      [],
      ["Laba Sebelum Pajak", data.labaSebelumPajak],
      ["Pajak Penghasilan", data.pajakPenghasilan],
      ["LABA BERSIH", data.labaBersih],
    ];
    const ak = [
      ["LAPORAN ARUS KAS", "", startDate + " s/d " + endDate],
      [],
      ["Arus Kas Operasi", data.kasOperasi],
      ["Arus Kas Investasi", data.kasInvestasi],
      ["Arus Kas Pendanaan", data.kasPendanaan],
      ["Kenaikan/(Penurunan) Kas Bersih", data.kasOperasi + data.kasInvestasi + data.kasPendanaan],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(neraca), "Neraca");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lr), "Laba Rugi");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ak), "Arus Kas");
    XLSX.writeFile(wb, `Laporan_SAK_ETAP_${startDate}_${endDate}.xlsx`);
  };

  if (!isPengurus) return <EmptyState icon={ShieldAlert} title="Akses Ditolak" desc="Halaman ini hanya untuk pengurus." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Keuangan SAK ETAP</h1>
          <p className="text-sm text-muted-foreground">Neraca, Laba Rugi, Arus Kas, Perubahan Ekuitas — dihasilkan otomatis dari transaksi koperasi.</p>
        </div>
        <Button onClick={exportExcel} disabled={!data} className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label className="text-xs">Periode Mulai</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Periode Akhir</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="neraca">
          <TabsList>
            <TabsTrigger value="neraca">Neraca</TabsTrigger>
            <TabsTrigger value="laba-rugi">Laba Rugi</TabsTrigger>
            <TabsTrigger value="arus-kas">Arus Kas</TabsTrigger>
            <TabsTrigger value="ekuitas">Perubahan Ekuitas</TabsTrigger>
          </TabsList>

          <TabsContent value="neraca">
            <div className="grid gap-4 md:grid-cols-2">
              <ReportCard title="ASET">
                <Row label="Kas & Setara Kas" value={data.kasAkhir} />
                <Row label="Piutang Anggota (Pinjaman)" value={data.piutangAnggota} />
                <Row label="Aset Tetap — Harga Perolehan" value={data.totalAsetTetap} muted />
                <Row label="Akumulasi Penyusutan (periode)" value={-data.totalAkumDep} muted />
                <Row label="Aset Tetap (Nilai Buku)" value={data.nilaiBukuAset} />
                <hr />
                <Row label="TOTAL ASET" value={data.totalAset} bold />
              </ReportCard>
              <ReportCard title="LIABILITAS & EKUITAS">
                <div className="text-xs font-semibold text-muted-foreground">LIABILITAS</div>
                <Row label="Total Liabilitas" value={data.totalLiabilitas} />
                <div className="mt-3 text-xs font-semibold text-muted-foreground">EKUITAS</div>
                <Row label="Simpanan Pokok" value={data.simpananPokok} />
                <Row label="Simpanan Wajib" value={data.simpananWajib} />
                <Row label="Simpanan Sukarela" value={data.simpananSukarela} />
                <Row label="Laba Tahun Berjalan" value={data.labaBersih} />
                <hr />
                <Row label="TOTAL EKUITAS" value={data.totalEkuitas} bold />
                <Row label="TOTAL LIABILITAS + EKUITAS" value={data.totalLiabilitas + data.totalEkuitas} bold />
              </ReportCard>
            </div>
          </TabsContent>

          <TabsContent value="laba-rugi">
            <ReportCard title="LAPORAN LABA RUGI">
              <div className="text-xs font-semibold text-muted-foreground">PENDAPATAN</div>
              <Row label="Pendapatan Jasa Pinjaman + Denda" value={data.pendapatanOperasional} />
              <Row label="Total Pendapatan" value={data.pendapatanOperasional} bold />
              <div className="mt-3 text-xs font-semibold text-muted-foreground">BEBAN OPERASIONAL</div>
              {Object.entries(data.opexByCategory).map(([cat, v]) => (
                <Row key={cat} label={cat} value={-Number(v)} />
              ))}
              <Row label="Beban Penyusutan Aset" value={-data.bebanPenyusutan} />
              <Row label="Total Beban" value={-(data.bebanOperasional + data.bebanPenyusutan)} bold />
              <hr />
              <Row label="Laba Sebelum Pajak" value={data.labaSebelumPajak} bold />
              <Row label="Pajak (PPh withheld)" value={-data.pajakPenghasilan} />
              <Row label="LABA BERSIH" value={data.labaBersih} bold highlight />
            </ReportCard>
          </TabsContent>

          <TabsContent value="arus-kas">
            <ReportCard title="LAPORAN ARUS KAS (Metode Langsung)">
              <div className="text-xs font-semibold text-muted-foreground">AKTIVITAS OPERASI</div>
              <Row label="Penerimaan Angsuran + Denda" value={data.angsuranMasuk + data.dendaMasuk} />
              <Row label="Pembayaran Beban Operasional" value={-data.opexTotal} />
              <Row label="Arus Kas Bersih dari Operasi" value={data.kasOperasi} bold />
              <div className="mt-3 text-xs font-semibold text-muted-foreground">AKTIVITAS INVESTASI</div>
              <Row label="Pembelian Aset Tetap" value={data.kasInvestasi} />
              <Row label="Arus Kas Bersih Investasi" value={data.kasInvestasi} bold />
              <div className="mt-3 text-xs font-semibold text-muted-foreground">AKTIVITAS PENDANAAN</div>
              <Row label="Penerimaan Simpanan" value={data.simpananMasuk} />
              <Row label="Penyaluran Pinjaman" value={-data.pinjamanCair} />
              <Row label="Arus Kas Bersih Pendanaan" value={data.kasPendanaan} bold />
              <hr />
              <Row label="KENAIKAN/(PENURUNAN) KAS" value={data.kasOperasi + data.kasInvestasi + data.kasPendanaan} bold highlight />
            </ReportCard>
          </TabsContent>

          <TabsContent value="ekuitas">
            <ReportCard title="LAPORAN PERUBAHAN EKUITAS">
              <Row label="Simpanan Pokok (akumulasi)" value={data.simpananPokok} />
              <Row label="Simpanan Wajib (akumulasi)" value={data.simpananWajib} />
              <Row label="Simpanan Sukarela (akumulasi)" value={data.simpananSukarela} />
              <Row label="Total SHU (semua periode)" value={data.shuTotal} />
              <Row label="Laba Tahun Berjalan" value={data.labaBersih} />
              <hr />
              <Row label="TOTAL EKUITAS AKHIR" value={data.totalEkuitas} bold highlight />
            </ReportCard>
          </TabsContent>
        </Tabs>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Catatan</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>• Laporan ini dihasilkan otomatis dari data simpanan, pinjaman, angsuran, OPEX, aset, dan penyusutan.</p>
          <p>• Pendapatan bunga pinjaman dihitung dari selisih (total_bayar - nominal) untuk pinjaman yang dicairkan pada periode ini.</p>
          <p>• Beban penyusutan diambil dari snapshot bulanan tabel asset_depreciations.</p>
          <p>• Untuk laporan SAK ETAP yang fully-compliant, perlu modul jurnal umum (general ledger) dengan chart of accounts terstruktur.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 text-sm">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value, bold, highlight, muted }: { label: string; value: number; bold?: boolean; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "font-bold" : ""} ${highlight ? "text-primary" : ""} ${muted ? "text-muted-foreground text-xs" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">{fmt(value)}</span>
    </div>
  );
}

function aggregate<T>(arr: T[], keyFn: (x: T) => string, valFn: (x: T) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = keyFn(x);
    out[k] = (out[k] || 0) + valFn(x);
  }
  return out;
}
