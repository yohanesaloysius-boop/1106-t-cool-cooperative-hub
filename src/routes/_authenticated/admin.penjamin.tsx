import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/penjamin")({
  component: AdminPenjaminPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  approved: "bg-success/10 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function AdminPenjaminPage() {
  const q = useQuery({
    queryKey: ["admin-guarantors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_guarantors")
        .select("*, pinjaman:pinjaman_id(nominal,status), borrower:borrower_id(nama_lengkap,nomor_anggota), guarantor:guarantor_id(nama_lengkap,nomor_anggota)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = (() => {
    const all = q.data ?? [];
    const approved = all.filter((r: any) => r.status === "approved");
    const totalExposure = approved.reduce((s: number, r: any) => s + Number(r.guarantee_amount || 0), 0);
    return {
      total: all.length,
      pending: all.filter((r: any) => r.status === "pending").length,
      approved: approved.length,
      rejected: all.filter((r: any) => r.status === "rejected").length,
      exposure: totalExposure,
    };
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Monitoring Penjamin Pinjaman
        </h1>
        <p className="text-sm text-muted-foreground">Pantau seluruh relasi penjaminan dan risiko kredit koperasi.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">{stats.pending}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Disetujui</p><p className="text-2xl font-bold text-success">{stats.approved}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Ditolak</p><p className="text-2xl font-bold text-destructive">{stats.rejected}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total Tanggungan</p><p className="text-lg font-bold text-primary">{fmt.format(stats.exposure)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        {q.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : q.data?.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Belum ada data penjaminan.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Peminjam</TableHead>
                <TableHead>Penjamin</TableHead>
                <TableHead className="text-right">Pinjaman</TableHead>
                <TableHead className="text-right">Tanggungan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{dfmt(r.requested_at)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{r.borrower?.nama_lengkap ?? "—"}</div>
                    <div className="text-muted-foreground">{r.borrower?.nomor_anggota ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{r.guarantor?.nama_lengkap ?? "—"}</div>
                    <div className="text-muted-foreground">{r.guarantor?.nomor_anggota ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmt.format(Number(r.pinjaman?.nominal ?? 0))}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmt.format(Number(r.guarantee_amount))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[r.status] ?? ""}>{r.status}</Badge>
                    {r.rejected_reason && (
                      <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {r.rejected_reason}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}