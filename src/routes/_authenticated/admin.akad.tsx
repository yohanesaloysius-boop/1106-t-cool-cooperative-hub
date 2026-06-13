import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { AkadDownloadButton } from "@/components/akad-sign-dialog";
import { Loader2, FileSignature, CheckCircle2, Clock, FileCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/akad")({
  head: () => ({ meta: [{ title: "Status Akad Pinjaman — T-COOL Koperasi" }] }),
  component: AkadStatusPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const statusMeta: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_member: { label: "Menunggu TTD Anggota", variant: "secondary" },
  pending_pengurus: { label: "Menunggu TTD Pengurus", variant: "outline" },
  signed: { label: "Akad Lengkap", variant: "default" },
};

function AkadStatusPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-akad"],
    queryFn: async () => {
      const { data: akads, error } = await (supabase.from("loan_agreements" as any)
        .select("id,pinjaman_id,user_id,status,pdf_path,member_signed_at,pengurus_signed_at,snapshot,created_at")
        .order("created_at", { ascending: false })
        .limit(200));
      if (error) throw error;
      const list = (akads as any[]) ?? [];
      const ids = Array.from(new Set(list.map((a) => a.user_id)));
      let map = new Map<string, any>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,nama_lengkap,nomor_anggota")
          .in("id", ids);
        map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      return list.map((a) => ({ ...a, profile: map.get(a.user_id) ?? null }));
    },
  });

  const rows = data ?? [];
  const total = rows.length;
  const lengkap = rows.filter((r: any) => r.status === "signed").length;
  const menungguAnggota = rows.filter((r: any) => r.status === "pending_member").length;
  const menungguPengurus = rows.filter((r: any) => r.status === "pending_pengurus").length;

  const stats = [
    { label: "Total Akad", value: total, icon: FileSignature, accent: "text-primary" },
    { label: "Menunggu Anggota", value: menungguAnggota, icon: Clock, accent: "text-warning" },
    { label: "Menunggu Pengurus", value: menungguPengurus, icon: FileCheck, accent: "text-warning" },
    { label: "Akad Lengkap", value: lengkap, icon: CheckCircle2, accent: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Status Akad Pinjaman</h1>
        <p className="text-sm text-muted-foreground">Ringkasan status tanda tangan akad: anggota → pengurus → lengkap.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={`h-6 w-6 ${s.accent}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Akad</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <EmptyState title="Belum ada akad pinjaman" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="hidden md:table-cell">TTD Anggota</TableHead>
                    <TableHead className="hidden md:table-cell">TTD Pengurus</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dokumen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: any) => {
                    const meta = statusMeta[r.status] ?? { label: r.status, variant: "secondary" as const };
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("id-ID")}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{r.profile?.nama_lengkap ?? "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{r.profile?.nomor_anggota ?? ""}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt.format(Number(r.snapshot?.nominal ?? 0))}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {r.member_signed_at ? new Date(r.member_signed_at).toLocaleDateString("id-ID") : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {r.pengurus_signed_at ? new Date(r.pengurus_signed_at).toLocaleDateString("id-ID") : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          {r.pdf_path ? <AkadDownloadButton pdfPath={r.pdf_path} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}