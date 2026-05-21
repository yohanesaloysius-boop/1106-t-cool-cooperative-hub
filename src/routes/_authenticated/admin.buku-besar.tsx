import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Loader2, ShieldAlert, Radio, Search } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/admin/buku-besar")({
  component: AdminBukuBesarPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date) =>
  new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function AdminBukuBesarPage() {
  const { isPengurus, loading } = useAuth();
  const qc = useQueryClient();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [from, setFrom] = useState(firstDay.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const ledger = useQuery({
    queryKey: ["admin-jurnal-umum", from, to],
    enabled: isPengurus,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_jurnal_umum", { _from: from, _to: to });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 15000,
  });

  // Realtime: invalidate on any change in source tables
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-jurnal-umum"] });
  useRealtime("simpanan", invalidate);
  useRealtime("pinjaman", invalidate);
  useRealtime("angsuran", invalidate);
  useRealtime("shu", invalidate);

  const { rows, totalIn, totalOut } = useMemo(() => {
    const all = (ledger.data ?? []) as any[];
    const s = search.trim().toLowerCase();
    const filtered = s
      ? all.filter(
          (r) =>
            (r.nama_anggota ?? "").toLowerCase().includes(s) ||
            (r.nomor_anggota ?? "").toLowerCase().includes(s) ||
            (r.jenis ?? "").toLowerCase().includes(s) ||
            (r.keterangan ?? "").toLowerCase().includes(s),
        )
      : all;
    let tIn = 0, tOut = 0;
    filtered.forEach((r) => {
      const amt = Number(r.debit || 0) + Number(r.kredit || 0);
      if (r.arah === "in") tIn += amt;
      else tOut += amt;
    });
    return { rows: filtered, totalIn: tIn, totalOut: tOut };
  }, [ledger.data, search]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!isPengurus) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-2 text-sm">Akses khusus pengurus.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Jurnal Umum — Semua Anggota
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Radio className="h-3 w-3 text-success animate-pulse" /> Realtime — setiap transaksi anggota otomatis tercatat di sini.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" /> Cari (nama / no. anggota / jenis / keterangan)</label>
            <Input placeholder="Ketik untuk memfilter..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dari</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sampai</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Masuk</p>
          <p className="text-lg font-bold text-success">{fmt.format(totalIn)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Keluar</p>
          <p className="text-lg font-bold text-destructive">{fmt.format(totalOut)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Jumlah Transaksi</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {ledger.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Belum ada transaksi pada periode ini.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Anggota</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Masuk</TableHead>
                <TableHead className="text-right">Keluar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any, i: number) => {
                const amt = Number(r.debit || 0) + Number(r.kredit || 0);
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs whitespace-nowrap">{dfmt(r.tanggal)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.nama_anggota ?? "-"}</div>
                      {r.nomor_anggota && <div className="text-[10px] text-muted-foreground">{r.nomor_anggota}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">{r.keterangan}</TableCell>
                    <TableCell className="text-right font-mono text-success text-xs">
                      {r.arah === "in" ? fmt.format(amt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive text-xs">
                      {r.arah === "out" ? fmt.format(amt) : "—"}
                    </TableCell>
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
