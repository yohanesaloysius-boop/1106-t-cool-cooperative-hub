import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Loader2, ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/riwayat")({
  head: () => ({ meta: [{ title: "Riwayat Transaksi — T-COOL Koperasi" }] }),
  component: RiwayatPage,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const jenisLabel: Record<string, string> = {
  setoran: "Setoran Simpanan", penarikan: "Penarikan", pencairan_pinjaman: "Pencairan Pinjaman",
  angsuran: "Angsuran Pinjaman", shu: "SHU", biaya: "Biaya", lainnya: "Lainnya",
};

function RiwayatPage() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-trx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaksi")
        .select("id,kode,jenis,arah,nominal,tanggal,keterangan,created_at")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("my-trx-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transaksi", filter: `user_id=eq.${user.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch]);

  const totalIn = (data ?? []).filter((t) => t.arah === "in").reduce((a, b) => a + Number(b.nominal), 0);
  const totalOut = (data ?? []).filter((t) => t.arah === "out").reduce((a, b) => a + Number(b.nominal), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground">Semua mutasi keuangan akun Anda di koperasi.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15"><ArrowDownCircle className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">Total Pemasukan</p><p className="text-lg font-bold">{fmt(totalIn)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15"><ArrowUpCircle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Total Pengeluaran</p><p className="text-lg font-bold">{fmt(totalOut)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Mutasi ({data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !data?.length ? (
            <EmptyState title="Belum ada transaksi" desc="Setoran simpanan & angsuran Anda akan tampil di sini." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="hidden md:table-cell">Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(t.tanggal).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          {t.arah === "in" ? <ArrowDownCircle className="h-4 w-4 text-success" /> : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
                          {jenisLabel[t.jenis] ?? t.jenis}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{t.keterangan ?? "—"}</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold ${t.arah === "in" ? "text-success" : "text-destructive"}`}>
                        {t.arah === "in" ? "+" : "-"} {fmt(Number(t.nominal))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
