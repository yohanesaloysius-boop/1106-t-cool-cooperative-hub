import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Receipt, Loader2 } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/angsuran")({
  head: () => ({ meta: [{ title: "Angsuran Saya — T-COOL Koperasi" }] }),
  component: AngsuranPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function AngsuranPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payRow, setPayRow] = useState<{ id: string; nominal: number } | null>(null);
  const [bukti, setBukti] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["angsuran", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("angsuran").select("*").eq("user_id", user!.id).order("jatuh_tempo", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const today = new Date();
  const enriched = rows.map((r) => {
    const isOverdue = r.status === "unpaid" && new Date(r.jatuh_tempo) < today;
    return { ...r, displayStatus: isOverdue ? "overdue" : r.status };
  });

  const sisa = enriched.filter((r) => r.status !== "paid").reduce((s, r) => s + Number(r.nominal), 0);
  const lewat = enriched.filter((r) => r.displayStatus === "overdue").length;
  const next = enriched.find((r) => r.status === "unpaid");

  const pay = useMutation({
    mutationFn: async () => {
      if (!payRow) throw new Error("No row");
      const url = z.string().trim().url("URL bukti tidak valid").max(500).parse(bukti);
      const { error } = await supabase.from("angsuran").update({ status: "pending", bukti_url: url, paid_at: new Date().toISOString() }).eq("id", payRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bukti terkirim", { description: "Menunggu verifikasi pengurus." });
      setPayRow(null);
      setBukti("");
      qc.invalidateQueries({ queryKey: ["angsuran"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error("Gagal", { description: msg });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Angsuran Saya</h1>
        <p className="text-sm text-muted-foreground">Jadwal cicilan dan upload bukti pembayaran.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card style={{ boxShadow: "var(--shadow-card)", background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}>
          <CardContent className="p-5">
            <p className="text-sm opacity-80">Sisa Total Angsuran</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{fmt.format(sisa)}</p>
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
            <p className={`mt-2 text-2xl font-bold tracking-tight ${lewat > 0 ? "text-destructive" : ""}`}>{lewat}</p>
          </CardContent>
        </Card>
      </div>

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
                    <th className="p-3 text-left">Cicilan ke</th>
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
                      <td className="p-3 text-right font-medium">{fmt.format(Number(r.nominal))}</td>
                      <td className="p-3"><StatusBadge status={r.displayStatus} /></td>
                      <td className="p-3 text-right">
                        {r.status === "unpaid" || r.displayStatus === "overdue" ? (
                          <Button size="sm" variant="outline" onClick={() => { setPayRow({ id: r.id, nominal: Number(r.nominal) }); setBukti(""); }}>Bayar</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payRow} onOpenChange={(o) => !o && setPayRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Pembayaran</DialogTitle></DialogHeader>
          {payRow && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">Nominal yang dibayar</p>
                <p className="text-xl font-bold">{fmt.format(payRow.nominal)}</p>
              </div>
              <div>
                <Label>URL Bukti Transfer</Label>
                <Input type="url" className="mt-2" placeholder="https://..." value={bukti} onChange={(e) => setBukti(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Upload bukti ke Drive/Imgur lalu tempel link di sini.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayRow(null)}>Batal</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
              {pay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim Bukti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
