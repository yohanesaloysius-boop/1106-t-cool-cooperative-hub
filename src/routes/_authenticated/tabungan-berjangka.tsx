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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Loader2, CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FileUpload } from "@/components/file-upload";

export const Route = createFileRoute("/_authenticated/tabungan-berjangka")({
  head: () => ({ meta: [{ title: "Tabungan Berjangka — T-COOL Koperasi" }] }),
  component: Page,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const TENOR_BUNGA: Record<number, number> = { 3: 0.4, 6: 0.5, 12: 0.6, 24: 0.75 };

const schema = z.object({
  nominal: z.coerce.number().min(1_000_000, "Minimal Rp 1.000.000"),
  tenor_bulan: z.coerce.number().refine((v) => [3, 6, 12, 24].includes(v), "Tenor 3/6/12/24 bulan"),
  bukti_url: z.string().min(1, "Bukti transfer wajib"),
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nominal: "", tenor_bulan: "12", bukti_url: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tabjangka-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("tabungan_berjangka").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalAktif = rows.filter((r) => r.status === "active" || r.status === "matured").reduce((a, b) => a + Number(b.nominal), 0);
  const tenor = Number(form.tenor_bulan);
  const bunga = TENOR_BUNGA[tenor] ?? 0.5;
  const nominal = Number(form.nominal) || 0;
  const estimasi = nominal * (bunga / 100) * tenor;

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ ...form, tenor_bulan: tenor });
      const { error } = await supabase.from("tabungan_berjangka").insert({
        user_id: user!.id,
        nominal: parsed.nominal,
        tenor_bulan: parsed.tenor_bulan,
        bunga_persen: TENOR_BUNGA[parsed.tenor_bulan],
        bukti_url: parsed.bukti_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengajuan dikirim", { description: "Menunggu verifikasi pengurus." });
      setOpen(false);
      setForm({ nominal: "", tenor_bulan: "12", bukti_url: "" });
      qc.invalidateQueries({ queryKey: ["tabjangka-mine"] });
    },
    onError: (e: unknown) => toast.error("Gagal", { description: e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabungan Berjangka</h1>
          <p className="text-sm text-muted-foreground">Deposito koperasi dengan bagi hasil sesuai tenor.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Buka Tabungan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Buka Tabungan Berjangka</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tenor</Label>
                <Select value={form.tenor_bulan} onValueChange={(v) => setForm({ ...form, tenor_bulan: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 bulan ({TENOR_BUNGA[3]}%/bulan)</SelectItem>
                    <SelectItem value="6">6 bulan ({TENOR_BUNGA[6]}%/bulan)</SelectItem>
                    <SelectItem value="12">12 bulan ({TENOR_BUNGA[12]}%/bulan)</SelectItem>
                    <SelectItem value="24">24 bulan ({TENOR_BUNGA[24]}%/bulan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nominal (IDR)</Label>
                <Input type="number" min={1000000} className="mt-2" placeholder="5000000" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
              </div>
              {nominal > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="text-muted-foreground">Estimasi bagi hasil total</p>
                  <p className="text-lg font-bold text-primary">{fmt(estimasi)}</p>
                  <p className="text-xs text-muted-foreground">Total saat jatuh tempo: {fmt(nominal + estimasi)}</p>
                </div>
              )}
              <div>
                <Label>Bukti Transfer <span className="text-destructive">*</span></Label>
                <div className="mt-2">
                  <FileUpload bucket="bukti-transfer" userId={user!.id} accept="image/*,application/pdf" label="Unggah bukti" maxMB={4} onUploaded={(res) => setForm({ ...form, bukti_url: res.path })} />
                  {form.bukti_url && <p className="mt-1 text-[11px] text-success">✓ File terunggah</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-elegant)" }}>
        <CardContent className="p-6">
          <p className="text-sm opacity-80">Total Tabungan Berjangka Aktif</p>
          <p className="mt-1 text-3xl font-bold">{fmt(totalAktif)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Riwayat Tabungan</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Belum ada tabungan berjangka" desc="Mulai menabung dengan bagi hasil yang lebih tinggi." />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" /></div>
                    <div>
                      <p className="font-semibold">{fmt(Number(r.nominal))}</p>
                      <p className="text-xs text-muted-foreground">Tenor {r.tenor_bulan} bulan · {r.bunga_persen}%/bulan {r.tanggal_jatuh_tempo ? `· JT ${new Date(r.tanggal_jatuh_tempo).toLocaleDateString("id-ID")}` : ""}</p>
                    </div>
                  </div>
                  <Badge variant={r.status === "active" ? "default" : r.status === "matured" ? "secondary" : "outline"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
