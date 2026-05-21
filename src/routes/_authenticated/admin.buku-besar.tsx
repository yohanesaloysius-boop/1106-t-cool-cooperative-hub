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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Download, Loader2, FileText, Users, ShieldAlert } from "lucide-react";
import { MemberCard } from "@/components/member-card";
import { buildPassbookPdf } from "@/lib/passbook-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/buku-besar")({
  component: AdminBukuBesarPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function AdminBukuBesarPage() {
  const { isPengurus, loading } = useAuth();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [from, setFrom] = useState(firstDay.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const members = useQuery({
    queryKey: ["admin-members-list", search],
    enabled: isPengurus,
    queryFn: async () => {
      const q = supabase
        .from("profiles")
        .select("id, nama_lengkap, nomor_anggota, status, foto_url, joined_at, nik, email, no_hp")
        .is("deleted_at", null)
        .order("nama_lengkap", { ascending: true })
        .limit(200);
      const { data, error } = search
        ? await q.or(`nama_lengkap.ilike.%${search}%,nomor_anggota.ilike.%${search}%`)
        : await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = useMemo(
    () => (members.data ?? []).find((m) => m.id === memberId) ?? null,
    [members.data, memberId],
  );

  const isAll = memberId === "__all__";
  const ledger = useQuery({
    queryKey: ["admin-ledger", memberId, from, to],
    enabled: !!memberId,
    queryFn: async () => {
      if (isAll) {
        const { data, error } = await supabase.rpc("get_jurnal_umum", { _from: from, _to: to });
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase.rpc("get_member_ledger", {
        _user_id: memberId, _from: from, _to: to,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { rowsWithBalance, totalIn, totalOut, saldoAkhir } = useMemo(() => {
    const rows = [...((ledger.data as any[]) ?? [])].reverse();
    let bal = 0, tIn = 0, tOut = 0;
    const enriched = rows.map((r) => {
      const amt = Number(r.debit || 0) + Number(r.kredit || 0);
      if (r.arah === "in") { bal += amt; tIn += amt; }
      else { bal -= amt; tOut += amt; }
      return { ...r, saldo: bal };
    }).reverse();
    return { rowsWithBalance: enriched, totalIn: tIn, totalOut: tOut, saldoAkhir: bal };
  }, [ledger.data]);

  const exportPdf = async () => {
    if (!selected) return;
    try {
      setPdfBusy(true);
      const rows = [...rowsWithBalance].reverse().map((r: any) => ({
        tanggal: r.tanggal, jenis: r.jenis, keterangan: r.keterangan ?? "", arah: r.arah,
        masuk: r.arah === "in" ? Number(r.debit || 0) + Number(r.kredit || 0) : 0,
        keluar: r.arah === "out" ? Number(r.debit || 0) + Number(r.kredit || 0) : 0,
        saldo: r.saldo,
      }));
      const doc = await buildPassbookPdf({
        anggota: {
          nama: selected.nama_lengkap ?? "-",
          nomor: selected.nomor_anggota ?? null,
          nik: selected.nik ?? null,
          email: selected.email ?? null,
          no_hp: selected.no_hp ?? null,
          status: selected.status,
          joined_at: selected.joined_at ?? null,
        },
        koperasi: { nama: "T-COOL Koperasi", alamat: "Indonesia" },
        periode: { from, to },
        summary: { totalIn, totalOut, saldoAkhir },
        rows,
      });
      doc.save(`buku-besar-${selected.nomor_anggota ?? selected.id}-${from}_${to}.pdf`);
    } catch (e: any) {
      toast.error("Gagal export PDF", { description: e.message });
    } finally { setPdfBusy(false); }
  };

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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Buku Besar Anggota — Admin
        </h1>
        <p className="text-sm text-muted-foreground">Tinjau mutasi keuangan, audit transaksi, dan ekspor passbook anggota.</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Cari anggota</label>
            <Input placeholder="Nama atau nomor anggota..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Pilih anggota</label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder={members.isLoading ? "Memuat..." : "Pilih anggota"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">— Semua Anggota (Jurnal Umum) —</SelectItem>
                {(members.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nama_lengkap} {m.nomor_anggota ? `(${m.nomor_anggota})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dari</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sampai</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={exportPdf} disabled={!selected || isAll || pdfBusy || !rowsWithBalance.length}>
            {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Export PDF
          </Button>
        </div>
      </Card>

      {selected && !isAll && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <MemberCard
              nama={selected.nama_lengkap ?? "-"}
              nomor={selected.nomor_anggota ?? null}
              status={selected.status}
              joined_at={selected.joined_at ?? null}
              foto_url={selected.foto_url ?? null}
            />
          </div>
          <div className="lg:col-span-2 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total Masuk</p>
              <p className="text-lg font-bold text-success">{fmt.format(totalIn)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total Keluar</p>
              <p className="text-lg font-bold text-destructive">{fmt.format(totalOut)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Saldo Akhir</p>
              <p className="text-lg font-bold">{fmt.format(saldoAkhir)}</p>
            </Card>
          </div>
        </div>
      )}

      {isAll && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Masuk (Kredit Koperasi)</p>
            <p className="text-lg font-bold text-success">{fmt.format(totalIn)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Keluar (Debit Koperasi)</p>
            <p className="text-lg font-bold text-destructive">{fmt.format(totalOut)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Jumlah Transaksi</p>
            <p className="text-lg font-bold">{rowsWithBalance.length}</p>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {!memberId ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Pilih anggota terlebih dahulu.</div>
        ) : ledger.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : rowsWithBalance.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada transaksi pada periode ini.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                {isAll && <TableHead>Anggota</TableHead>}
                <TableHead>Jenis</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Masuk</TableHead>
                <TableHead className="text-right">Keluar</TableHead>
                {!isAll && <TableHead className="text-right">Saldo</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithBalance.map((r: any, i) => {
                const amt = Number(r.debit || 0) + Number(r.kredit || 0);
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs whitespace-nowrap">{dfmt(r.tanggal)}</TableCell>
                    {isAll && (
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.nama_anggota ?? "-"}</div>
                        {r.nomor_anggota && <div className="text-[10px] text-muted-foreground">{r.nomor_anggota}</div>}
                      </TableCell>
                    )}
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">{r.keterangan}</TableCell>
                    <TableCell className="text-right font-mono text-success text-xs">
                      {r.arah === "in" ? fmt.format(amt) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive text-xs">
                      {r.arah === "out" ? fmt.format(amt) : "—"}
                    </TableCell>
                    {!isAll && <TableCell className="text-right font-mono font-semibold text-xs">{fmt.format(r.saldo)}</TableCell>}
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