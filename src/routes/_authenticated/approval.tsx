import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, XCircle, QrCode, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/approval")({
  head: () => ({ meta: [{ title: "Status Approval — T-COOL" }] }),
  component: MyApprovalPage,
});

const TARGET_LABEL: Record<string, string> = {
  pinjaman: "Pinjaman", simpanan: "Simpanan", anggota: "Anggota", pengumuman: "Pengumuman", lainnya: "Dokumen",
};

function MyApprovalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-approvals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("approvals").select("*").eq("created_by", user!.id).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("my-approvals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: `created_by=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["my-approvals", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  // Group by target_id to show overall workflow status
  const groups = new Map<string, typeof rows>();
  rows.forEach((r) => {
    const k = `${r.target_type}:${r.target_id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Status Approval Saya</h1>
        <p className="text-sm text-muted-foreground">Pantau status persetujuan dokumen yang Anda ajukan.</p>
      </div>

      {isLoading ? (
        <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : groups.size === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Belum ada pengajuan approval.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([key, steps]) => {
            const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
            const overall = sorted.every((s) => s.status === "approved") ? "completed"
              : sorted.some((s) => s.status === "rejected") ? "rejected"
              : "pending";
            return (
              <Card key={key}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{TARGET_LABEL[sorted[0].target_type] ?? sorted[0].target_type}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">#{sorted[0].target_id.slice(0, 12)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OverallBadge status={overall} />
                      <Button asChild size="sm" variant="outline">
                        <Link to="/verify/$id" params={{ id: sorted[0].id }}><QrCode className="mr-1 h-3 w-3" />Verifikasi</Link>
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Step</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Diproses</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.step_order}</TableCell>
                          <TableCell className="capitalize">{s.required_role}</TableCell>
                          <TableCell><StepBadge status={s.status as "pending" | "approved" | "rejected" | "cancelled"} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.acted_at ? new Date(s.acted_at).toLocaleString("id-ID") : "—"}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{s.catatan ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepBadge({ status }: { status: "pending" | "approved" | "rejected" | "cancelled" }) {
  if (status === "approved") return <Badge variant="outline" className="border-success/30 bg-success/15 text-success"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
  if (status === "rejected") return <Badge variant="outline" className="border-destructive/30 bg-destructive/15 text-destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
  if (status === "cancelled") return <Badge variant="outline" className="border-border bg-muted text-muted-foreground">Cancelled</Badge>;
  return <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
}

function OverallBadge({ status }: { status: "completed" | "rejected" | "pending" }) {
  if (status === "completed") return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Completed</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
  return <Badge className="bg-warning text-warning-foreground"><Clock className="mr-1 h-3 w-3" />In Progress</Badge>;
}