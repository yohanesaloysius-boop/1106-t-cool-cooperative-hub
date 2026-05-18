import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/penjamin")({
  component: PenjaminPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const statusBadge: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Menunggu", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: Clock },
  approved: { label: "Disetujui", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  rejected: { label: "Ditolak", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  expired: { label: "Kadaluarsa", cls: "bg-muted text-muted-foreground", icon: AlertTriangle },
  cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusBadge[status] ?? statusBadge.pending;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${s.cls}`}>
      <Icon className="h-3 w-3" /> {s.label}
    </Badge>
  );
}

function PenjaminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Requests where I am the guarantor
  const asGuarantor = useQuery({
    queryKey: ["guarantor-as-guarantor", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_guarantors")
        .select("*, pinjaman:pinjaman_id(id,nominal,tenor_bulan,tujuan,status), borrower:borrower_id(nama_lengkap,nomor_anggota,no_hp)")
        .eq("guarantor_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Requests I sent as borrower
  const asBorrower = useQuery({
    queryKey: ["guarantor-as-borrower", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_guarantors")
        .select("*, pinjaman:pinjaman_id(id,nominal,status), guarantor:guarantor_id(nama_lengkap,nomor_anggota,no_hp)")
        .eq("borrower_id", user!.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason?: string }) => {
      const { error } = await supabase.rpc("act_on_guarantor_request", { _id: id, _action: action, _reason: reason ?? undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Berhasil");
      qc.invalidateQueries({ queryKey: ["guarantor-as-guarantor"] });
      qc.invalidateQueries({ queryKey: ["guarantor-as-borrower"] });
      setRejectId(null); setRejectReason("");
    },
    onError: (e) => toast.error("Gagal", { description: (e as Error).message }),
  });

  const pendingCount = asGuarantor.data?.filter((r: any) => r.status === "pending").length ?? 0;
  const totalExposure = (asGuarantor.data ?? [])
    .filter((r: any) => r.status === "approved")
    .reduce((sum: number, r: any) => sum + Number(r.guarantee_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Penjamin Pinjaman
        </h1>
        <p className="text-sm text-muted-foreground">Kelola permintaan menjadi penjamin dan lihat tanggungan Anda.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Menunggu Respon</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Tanggungan Aktif</p>
          <p className="text-2xl font-bold text-primary">{fmt.format(totalExposure)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Permintaan Saya</p>
          <p className="text-2xl font-bold">{asBorrower.data?.length ?? 0}</p>
        </Card>
      </div>

      <Tabs defaultValue="incoming">
        <TabsList>
          <TabsTrigger value="incoming">
            Permintaan Masuk {pendingCount > 0 && <Badge className="ml-2 h-5 px-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="outgoing">Permintaan Saya</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-3 mt-4">
          {asGuarantor.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
          {asGuarantor.data?.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Belum ada permintaan menjadi penjamin.
            </Card>
          )}
          {asGuarantor.data?.map((r: any) => (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.borrower?.nama_lengkap ?? "Anggota"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.borrower?.nomor_anggota ?? "—"} · {r.borrower?.no_hp ?? "—"}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/40 p-2">
                  <p className="text-[11px] text-muted-foreground">Nominal Pinjaman</p>
                  <p className="font-semibold">{fmt.format(Number(r.pinjaman?.nominal ?? 0))}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <p className="text-[11px] text-muted-foreground">Tanggungan Anda</p>
                  <p className="font-semibold text-primary">{fmt.format(Number(r.guarantee_amount))}</p>
                </div>
              </div>
              {r.pinjaman?.tujuan && (
                <p className="text-xs text-muted-foreground italic">"{r.pinjaman.tujuan}"</p>
              )}
              {r.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm" variant="outline" className="flex-1 text-destructive"
                    onClick={() => setRejectId(r.id)}
                    disabled={act.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Tolak
                  </Button>
                  <Button
                    size="sm" className="flex-1"
                    onClick={() => act.mutate({ id: r.id, action: "approve" })}
                    disabled={act.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Setuju
                  </Button>
                </div>
              )}
              {r.rejected_reason && (
                <p className="text-xs text-destructive border-t pt-2">Alasan: {r.rejected_reason}</p>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-3 mt-4">
          {asBorrower.data?.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Anda belum pernah meminta penjamin.
            </Card>
          )}
          {asBorrower.data?.map((r: any) => (
            <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{r.guarantor?.nama_lengkap ?? "Anggota"}</p>
                <p className="text-xs text-muted-foreground">
                  Pinjaman {fmt.format(Number(r.pinjaman?.nominal ?? 0))} · Tanggungan {fmt.format(Number(r.guarantee_amount))}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectId} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tolak permintaan penjamin?</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Alasan penolakan (wajib)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectId(null)}>Batal</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || act.isPending}
              onClick={() => rejectId && act.mutate({ id: rejectId, action: "reject", reason: rejectReason })}
            >
              {act.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}