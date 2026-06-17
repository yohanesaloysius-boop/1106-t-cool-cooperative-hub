import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, ArrowDownCircle, ArrowUpCircle, Download, Loader2, PiggyBank, HandCoins, Wallet, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberCardDisplay } from "@/components/member-card-display";
import { buildPassbookPdf } from "@/lib/passbook-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/buku-besar")({
  component: BukuBesarPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

type LedgerRow = {
  tanggal: string;
  jenis: string;
  keterangan: string;
  arah: "in" | "out";
  debit: number;
  kredit: number;
  ref_table: string;
  ref_id: string;
  status: string | null;
};

function BukuBesarPage() {
  const { user, profile } = useAuth();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [from, setFrom] = useState(firstDay.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [jenisFilter, setJenisFilter] = useState<string>("all");
  const [pdfBusy, setPdfBusy] = useState(false);

  const q = useQuery({
    queryKey: ["ledger", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_ledger", {
        _user_id: user!.id,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
  });

  const profileExtra = useQuery({
    queryKey: ["profile-extra", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("nik, joined_at, foto_bg").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as { nik: string | null; joined_at: string | null } | null;
    },
  });

  const jenisList = useMemo(() => {
    const s = new Set<string>();
    (q.data ?? []).forEach((r) => s.add(r.jenis));
    return Array.from(s);
  }, [q.data]);

  const { rowsWithBalance, totalIn, totalOut, saldoAkhir, byJenis } = useMemo(() => {
    const rows = [...(q.data ?? [])].reverse(); // oldest first for running balance
    let bal = 0;
    let tIn = 0, tOut = 0;
    const by: Record<string, number> = {};
    const enriched = rows.map((r) => {
      const amt = Number(r.debit || 0) + Number(r.kredit || 0);
      if (r.arah === "in") { bal += amt; tIn += amt; by[r.jenis] = (by[r.jenis] ?? 0) + amt; }
      else { bal -= amt; tOut += amt; by[r.jenis] = (by[r.jenis] ?? 0) - amt; }
      return { ...r, saldo: bal };
    }).reverse();
    const filtered = jenisFilter === "all" ? enriched : enriched.filter((r) => r.jenis === jenisFilter);
    return { rowsWithBalance: filtered, totalIn: tIn, totalOut: tOut, saldoAkhir: bal, byJenis: by };
  }, [q.data, jenisFilter]);

  const totalSimpanan = (byJenis["Simpanan"] ?? 0);
  const pencairanPinjaman = (byJenis["Pencairan Pinjaman"] ?? 0);
  const totalAngsuran = Math.abs(byJenis["Angsuran"] ?? 0);
  const sisaCicilan = Math.max(0, pencairanPinjaman - totalAngsuran);
  const totalShu = (byJenis["SHU"] ?? 0);

  const exportCsv = () => {
    const header = ["Tanggal", "Jenis", "Keterangan", "Masuk", "Keluar", "Saldo", "Status"];
    const lines = [header.join(",")];
    [...rowsWithBalance].reverse().forEach((r: any) => {
      const masuk = r.arah === "in" ? Number(r.debit || 0) + Number(r.kredit || 0) : 0;
      const keluar = r.arah === "out" ? Number(r.debit || 0) + Number(r.kredit || 0) : 0;
      lines.push([
        dfmt(r.tanggal),
        r.jenis,
        `"${(r.keterangan ?? "").replace(/"/g, '""')}"`,
        masuk, keluar, r.saldo, r.status ?? "",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `buku-besar-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!profile) return;
    try {
      setPdfBusy(true);
      const rows = [...rowsWithBalance].reverse().map((r: any) => ({
        tanggal: r.tanggal,
        jenis: r.jenis,
        keterangan: r.keterangan ?? "",
        arah: r.arah,
        masuk: r.arah === "in" ? Number(r.debit || 0) + Number(r.kredit || 0) : 0,
        keluar: r.arah === "out" ? Number(r.debit || 0) + Number(r.kredit || 0) : 0,
        saldo: r.saldo,
      }));
      const doc = await buildPassbookPdf({
        anggota: {
          nama: profile.nama_lengkap ?? "-",
          nomor: profile.nomor_anggota ?? null,
          nik: profileExtra.data?.nik ?? null,
          email: profile.email ?? null,
          no_hp: profile.no_hp ?? null,
          status: profile.status,
          joined_at: profileExtra.data?.joined_at ?? null,
        },
        koperasi: { nama: "T-COOL Koperasi", alamat: "Indonesia" },
        periode: { from, to },
        summary: { totalIn, totalOut, saldoAkhir },
        rows,
      });
      doc.save(`buku-besar-${profile.nomor_anggota ?? "anggota"}-${from}_${to}.pdf`);
    } catch (e: any) {
      toast.error("Gagal membuat PDF", { description: e.message });
    } finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Buku Besar Anggota
          </h1>
          <p className="text-sm text-muted-foreground">Passbook digital koperasi — riwayat simpanan, pinjaman, angsuran, denda, dan SHU dengan saldo berjalan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rowsWithBalance.length}>
            <Download className="h-4 w-4 mr-1" /> Ekspor CSV
          </Button>
          <Button size="sm" onClick={exportPdf} disabled={!rowsWithBalance.length || pdfBusy}>
            {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Ekspor PDF
          </Button>
        </div>
      </div>

      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <MemberCardDisplay
              nama={profile.nama_lengkap ?? "-"}
              nomor={profile.nomor_anggota ?? null}
              foto_url={profile.foto_url ?? null}
              joined_at={profileExtra.data?.joined_at ?? null}
              fotoBg={(profileExtra.data?.foto_bg as "transparent" | "white" | undefined) ?? "white"}
            />
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><PiggyBank className="h-3.5 w-3.5 text-primary" /> Total Simpanan</p>
              <p className="text-lg font-bold">{fmt.format(totalSimpanan)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><HandCoins className="h-3.5 w-3.5 text-amber-600" /> Pinjaman Cair</p>
              <p className="text-lg font-bold">{fmt.format(pencairanPinjaman)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-destructive" /> Sisa Cicilan (perk.)</p>
              <p className="text-lg font-bold">{fmt.format(sisaCicilan)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-success" /> SHU Diterima</p>
              <p className="text-lg font-bold">{fmt.format(totalShu)}</p>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4 md:col-span-2 flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Dari</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Sampai</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Jenis</label>
            <Select value={jenisFilter} onValueChange={setJenisFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {jenisList.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownCircle className="h-3 w-3 text-success" /> Total Masuk</p>
          <p className="text-lg font-bold text-success">{fmt.format(totalIn)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpCircle className="h-3 w-3 text-destructive" /> Total Keluar</p>
          <p className="text-lg font-bold text-destructive">{fmt.format(totalOut)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {q.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : rowsWithBalance.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</div>
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
              {rowsWithBalance.map((r: any, i) => {
                const amt = Number(r.debit || 0) + Number(r.kredit || 0);
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs whitespace-nowrap">{dfmt(r.tanggal)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">{r.keterangan}</TableCell>
                    <TableCell className="text-right font-mono text-success text-xs">
                      {r.arah === "in" ? fmt.format(amt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive text-xs">
                      {r.arah === "out" ? fmt.format(amt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-xs">{fmt.format(r.saldo)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}