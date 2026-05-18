import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Receipt, Loader2, AlertTriangle, FileDown, ExternalLink } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { FileUpload, type UploadResult } from "@/components/file-upload";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/angsuran")({
  head: () => ({ meta: [{ title: "Angsuran Saya — T-COOL Koperasi" }] }),
  component: AngsuranPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type Row = {
  id: string; pinjaman_id: string; cicilan_ke: number; nominal: number;
  jatuh_tempo: string; status: "unpaid" | "pending" | "paid" | "overdue";
  bukti_url: string | null; paid_at: string | null;
  denda: number | null;
};

function AngsuranPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [payRow, setPayRow] = useState<Row | null>(null);
  const [bukti, setBukti] = useState<UploadResult | null>(null);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["angsuran", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("angsuran").select("id,pinjaman_id,cicilan_ke,nominal,jatuh_tempo,status,bukti_url,paid_at").eq("user_id", user!.id).order("jatuh_tempo");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Realtime tracking
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`angsuran-self-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "angsuran", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["angsuran", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const today = new Date();
  const enriched = rows.map((r) => {
    const overdue = r.status === "unpaid" && new Date(r.jatuh_tempo) < today;
    return { ...r, displayStatus: overdue ? "overdue" : r.status };
  });

  const sisaTotal = enriched.filter((r) => r.status !== "paid").reduce((s, r) => s + Number(r.nominal), 0);
  const overdueRows = enriched.filter((r) => r.displayStatus === "overdue");
  const next = enriched.find((r) => r.status === "unpaid");

  // Group per pinjaman for sisa hutang otomatis
  const perPinjaman = useMemo(() => {
    const map = new Map<string, { total: number; lunas: number; pending: number; sisa: number; jumlah: number; lunasCount: number }>();
    for (const r of enriched) {
      const cur = map.get(r.pinjaman_id) ?? { total: 0, lunas: 0, pending: 0, sisa: 0, jumlah: 0, lunasCount: 0 };
      cur.total += Number(r.nominal); cur.jumlah += 1;
      if (r.status === "paid") { cur.lunas += Number(r.nominal); cur.lunasCount += 1; }
      else if (r.status === "pending") cur.pending += Number(r.nominal);
      else cur.sisa += Number(r.nominal);
      map.set(r.pinjaman_id, cur);
    }
    return Array.from(map.entries());
  }, [enriched]);

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!payRow || !bukti) throw new Error("Pilih bukti pembayaran terlebih dahulu");
      const { error } = await supabase.from("angsuran").update({
        status: "pending", bukti_url: bukti.path, paid_at: new Date().toISOString(),
      }).eq("id", payRow.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user!.id, action: "angsuran.pay_submitted", entity: "angsuran", entity_id: payRow.id,
        new_data: { bukti_url: bukti.path, nominal: payRow.nominal },
      });
    },
    onSuccess: () => {
      toast.success("Bukti terkirim", { description: "Menunggu verifikasi bendahara." });
      setPayRow(null); setBukti(null);
      qc.invalidateQueries({ queryKey: ["angsuran"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  const viewBukti = async (path: string) => {
    const { data, error } = await supabase.storage.from("ktp").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("Tidak bisa membuka bukti"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const downloadReceipt = (r: Row) => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("BUKTI PEMBAYARAN ANGSURAN", 105, 20, { align: "center" });
    doc.setFontSize(10); doc.text("T-COOL Koperasi", 105, 27, { align: "center" });
    autoTable(doc, {
      startY: 40,
      body: [
        ["No. Anggota", profile?.nomor_anggota ?? "-"],
        ["Nama", profile?.nama_lengkap ?? "-"],
        ["No. Pinjaman", r.pinjaman_id.slice(0, 8).toUpperCase()],
        ["Cicilan ke", `#${r.cicilan_ke}`],
        ["Jatuh Tempo", new Date(r.jatuh_tempo).toLocaleDateString("id-ID")],
        ["Tanggal Bayar", r.paid_at ? new Date(r.paid_at).toLocaleString("id-ID") : "-"],
        ["Nominal", fmt.format(Number(r.nominal))],
        ["Status", "LUNAS"],
      ],
      theme: "grid", styles: { fontSize: 10 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, doc.internal.pageSize.height - 10);
    doc.save(`bukti-cicilan-${r.cicilan_ke}-${r.id.slice(0, 6)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Angsuran Saya</h1>
        <p className="text-sm text-muted-foreground">Tracking cicilan realtime, upload bukti & unduh kuitansi.</p>
      </div>

      {overdueRows.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-destructive">Anda memiliki {overdueRows.length} angsuran terlambat</p>
            <p className="text-foreground/80">Total tunggakan: <span className="font-semibold">{fmt.format(overdueRows.reduce((s, r) => s + Number(r.nominal), 0))}</span>. Segera lakukan pembayaran untuk menghindari sanksi.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card style={{ boxShadow: "var(--shadow-card)", background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
          <CardContent className="p-5">
            <p className="text-sm opacity-80">Sisa Hutang</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{fmt.format(sisaTotal)}</p>
          </CardContent>
        </Card>
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Cicilan Terdekat</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{next ? fmt.format(Number(next.nominal)) : "—"}</p>
            {next && <p className="mt-1 text-xs text-muted-foreground">Jatuh tempo {new Date(next.jatuh_tempo).toLocaleDateString("id-ID")}</p>}
          </CardContent>
        </Card>
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Lewat Jatuh Tempo</p>
            <p className={`mt-2 text-2xl font-bold tracking-tight ${overdueRows.length > 0 ? "text-destructive" : ""}`}>{overdueRows.length}</p>
          </CardContent>
        </Card>
      </div>

      {perPinjaman.length > 0 && (
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader><CardTitle className="text-base">Progres Pinjaman</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {perPinjaman.map(([pid, agg]) => {
              const pct = agg.total === 0 ? 0 : Math.round((agg.lunas / agg.total) * 100);
              return (
                <div key={pid} className="space-y-2 rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">PJM-{pid.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm font-medium">{agg.lunasCount}/{agg.jumlah} cicilan lunas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Sisa hutang</p>
                      <p className="text-lg font-bold tabular-nums">{fmt.format(agg.sisa + agg.pending)}</p>
                    </div>
                  </div>
                  <Progress value={pct} />
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Lunas {fmt.format(agg.lunas)}</span><span>{pct}%</span></div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Jadwal Angsuran</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : enriched.length === 0 ? (
            <EmptyState icon={Receipt} title="Belum ada jadwal angsuran" desc="Jadwal akan muncul setelah pinjaman Anda disetujui dan dicairkan." />
          ) : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="p-3 text-left">Cicilan</th>
                    <th className="p-3 text-left">Jatuh Tempo</th>
                    <th className="p-3 text-right">Nominal</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 font-medium">#{r.cicilan_ke}</td>
                      <td className="p-3">{new Date(r.jatuh_tempo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="p-3 text-right font-medium tabular-nums">{fmt.format(Number(r.nominal))}</td>
                      <td className="p-3"><StatusBadge status={r.displayStatus} /></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {r.bukti_url && (
                            <Button size="sm" variant="ghost" onClick={() => viewBukti(r.bukti_url!)}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {r.status === "paid" && (
                            <Button size="sm" variant="ghost" onClick={() => downloadReceipt(r)}>
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(r.status === "unpaid" || r.displayStatus === "overdue") && (
                            <Button size="sm" variant="outline" onClick={() => { setPayRow(r); setBukti(null); }}>Bayar</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payRow} onOpenChange={(o) => { if (!o) { setPayRow(null); setBukti(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Pembayaran</DialogTitle></DialogHeader>
          {payRow && user && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">Cicilan #{payRow.cicilan_ke} · Jatuh tempo {new Date(payRow.jatuh_tempo).toLocaleDateString("id-ID")}</p>
                <p className="text-xl font-bold">{fmt.format(Number(payRow.nominal))}</p>
              </div>
              <FileUpload
                bucket="ktp"
                userId={user.id}
                accept="image/*,application/pdf"
                label="Upload Bukti Transfer"
                hint="Foto/scan struk transfer (maks 4MB). PDF atau gambar."
                onUploaded={(r) => setBukti(r)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayRow(null); setBukti(null); }}>Batal</Button>
            <Button onClick={() => submitPayment.mutate()} disabled={submitPayment.isPending || !bukti}>
              {submitPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim Bukti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
