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
import { BookOpen, ArrowDownCircle, ArrowUpCircle, Download, Loader2 } from "lucide-react";

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
  const { user } = useAuth();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [from, setFrom] = useState(firstDay.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

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

  const { rowsWithBalance, totalIn, totalOut } = useMemo(() => {
    const rows = [...(q.data ?? [])].reverse(); // oldest first for running balance
    let bal = 0;
    let tIn = 0, tOut = 0;
    const enriched = rows.map((r) => {
      const amt = Number(r.debit || 0) + Number(r.kredit || 0);
      if (r.arah === "in") { bal += amt; tIn += amt; }
      else { bal -= amt; tOut += amt; }
      return { ...r, saldo: bal };
    }).reverse(); // newest first for display
    return { rowsWithBalance: enriched, totalIn: tIn, totalOut: tOut };
  }, [q.data]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Buku Besar Anggota
          </h1>
          <p className="text-sm text-muted-foreground">Riwayat lengkap setoran, pinjaman, angsuran, denda, dan SHU dengan saldo berjalan.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rowsWithBalance.length}>
          <Download className="h-4 w-4 mr-1" /> Ekspor CSV
        </Button>
      </div>

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