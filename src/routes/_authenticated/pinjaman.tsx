import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, HandCoins, Loader2, Calculator, Eye } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { calcLoan } from "@/components/dashboard/loan-calculator";
import { FileUpload } from "@/components/file-upload";
import { LoanDetailDialog } from "@/components/loan-detail-dialog";

type BungaJenis = "flat" | "efektif" | "menurun";

export const Route = createFileRoute("/_authenticated/pinjaman")({
  validateSearch: (s: Record<string, unknown>) => ({
    nominal: typeof s.nominal === "number" ? s.nominal : undefined,
    tenor: typeof s.tenor === "number" ? s.tenor : undefined,
    bunga: typeof s.bunga === "number" ? s.bunga : undefined,
    jenis: typeof s.jenis === "string" ? (s.jenis as BungaJenis) : undefined,
  }),
  head: () => ({ meta: [{ title: "Pinjaman Saya — T-COOL Koperasi" }] }),
  component: PinjamanPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const schema = z.object({
  nominal: z.coerce.number().min(500_000, "Minimal Rp 500.000").max(500_000_000),
  tenor_bulan: z.coerce.number().int().min(3, "Minimal 3 bulan").max(60, "Maksimal 60 bulan"),
  bunga_persen: z.coerce.number().min(0).max(20),
  bunga_jenis: z.enum(["flat", "efektif", "menurun"]),
  tujuan: z.string().trim().min(5, "Tujuan minimal 5 karakter").max(500),
  dokumen_url: z.string().trim().max(500).optional().or(z.literal("")),
});

function PinjamanPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nominal: search.nominal?.toString() ?? "",
    tenor_bulan: search.tenor?.toString() ?? "12",
    bunga_persen: search.bunga?.toString() ?? "1.5",
    bunga_jenis: (search.jenis ?? "flat") as BungaJenis,
    tujuan: "",
    dokumen_url: "",
  });

  useEffect(() => {
    if (search.nominal) setOpen(true);
  }, [search.nominal]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pinjaman", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("pinjaman").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sim = useMemo(() => {
    const n = Number(form.nominal) || 0;
    const t = Number(form.tenor_bulan) || 1;
    const b = Number(form.bunga_persen) || 0;
    if (n <= 0) return null;
    return calcLoan(n, t, b, form.bunga_jenis);
  }, [form]);

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const result = calcLoan(parsed.nominal, parsed.tenor_bulan, parsed.bunga_persen, parsed.bunga_jenis);
      const { error } = await supabase.from("pinjaman").insert({
        user_id: user!.id,
        nominal: parsed.nominal,
        tenor_bulan: parsed.tenor_bulan,
        bunga_persen: parsed.bunga_persen,
        bunga_jenis: parsed.bunga_jenis,
        tujuan: parsed.tujuan,
        dokumen_url: parsed.dokumen_url || null,
        cicilan_per_bulan: Math.round(result.cicilan),
        total_bayar: Math.round(result.totalBayar),
        status: "pending_sekretaris",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengajuan terkirim", { description: "Akan direview oleh sekretaris, bendahara, lalu ketua." });
      setOpen(false);
      setForm({ nominal: "", tenor_bulan: "12", bunga_persen: "1.5", bunga_jenis: "flat", tujuan: "", dokumen_url: "" });
      qc.invalidateQueries({ queryKey: ["pinjaman"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error("Gagal", { description: msg });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pinjaman Saya</h1>
          <p className="text-sm text-muted-foreground">Pengajuan dan status pinjaman Anda.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/kalkulator"><Calculator className="mr-2 h-4 w-4" />Kalkulator</Link></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Ajukan Pinjaman</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Pengajuan Pinjaman</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nominal (IDR)</Label>
                    <Input type="number" className="mt-2" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tenor (bulan)</Label>
                    <Input type="number" min={3} max={60} className="mt-2" value={form.tenor_bulan} onChange={(e) => setForm({ ...form, tenor_bulan: e.target.value })} />
                  </div>
                  <div>
                    <Label>Bunga / bulan (%)</Label>
                    <Input type="number" step="0.1" className="mt-2" value={form.bunga_persen} onChange={(e) => setForm({ ...form, bunga_persen: e.target.value })} />
                  </div>
                  <div>
                    <Label>Jenis Bunga</Label>
                    <Select value={form.bunga_jenis} onValueChange={(v) => setForm({ ...form, bunga_jenis: v as BungaJenis })}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="efektif">Efektif</SelectItem>
                        <SelectItem value="menurun">Menurun</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Tujuan Pinjaman</Label>
                  <Textarea className="mt-2" rows={3} maxLength={500} placeholder="Contoh: Modal usaha warung kelontong" value={form.tujuan} onChange={(e) => setForm({ ...form, tujuan: e.target.value })} />
                </div>
                <div>
                  <Label>Dokumen Pendukung (PDF/Gambar — opsional)</Label>
                  <div className="mt-2">
                    <FileUpload
                      bucket="ktp"
                      userId={user!.id}
                      accept="image/*,application/pdf"
                      label=""
                      hint="Disimpan privat untuk verifikasi pengurus."
                      maxMB={8}
                      onUploaded={(r) => setForm({ ...form, dokumen_url: r.path })}
                    />
                  </div>
                </div>
                {sim && (
                  <div className="rounded-xl p-4 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                    <p className="text-xs opacity-80">Estimasi cicilan / bulan</p>
                    <p className="text-xl font-bold">{fmt.format(Math.round(sim.cicilan))}</p>
                    <p className="mt-1 text-xs opacity-80">Total bayar: {fmt.format(Math.round(sim.totalBayar))}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim Pengajuan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Daftar Pinjaman</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={HandCoins} title="Belum ada pinjaman" desc="Ajukan pinjaman pertama Anda. Workflow approval bertingkat: Sekretaris → Bendahara → Ketua." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold tracking-tight">{fmt.format(Number(r.nominal))}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.tenor_bulan} bulan · Bunga {Number(r.bunga_persen)}% ({r.bunga_jenis}) · Cicilan {fmt.format(Number(r.cicilan_per_bulan ?? 0))}/bulan
                      </p>
                      {r.tujuan && <p className="mt-2 text-sm">{r.tujuan}</p>}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={r.status} />
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      <LoanDetailDialog
                        pinjamanId={r.id}
                        trigger={<Button size="sm" variant="ghost" className="mt-1 h-7 gap-1 text-xs"><Eye className="h-3 w-3" /> Detail</Button>}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
