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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, PiggyBank, Loader2 } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/simpanan")({
  head: () => ({ meta: [{ title: "Simpanan Saya — T-COOL Koperasi" }] }),
  component: SimpananPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const schema = z.object({
  jenis: z.enum(["pokok", "wajib", "sukarela"]),
  nominal: z.coerce.number().min(10_000, "Minimal Rp 10.000").max(1_000_000_000, "Terlalu besar"),
  catatan: z.string().trim().max(500).optional(),
  bukti_url: z.string().trim().url("URL tidak valid").max(500).optional().or(z.literal("")),
});

function SimpananPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ jenis: "wajib" as "pokok" | "wajib" | "sukarela", nominal: "", catatan: "", bukti_url: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["simpanan", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("simpanan").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totals = rows.filter((r) => r.status === "verified").reduce(
    (acc, r) => {
      const n = Number(r.nominal);
      acc.total += n;
      acc[r.jenis as "pokok" | "wajib" | "sukarela"] += n;
      return acc;
    },
    { total: 0, pokok: 0, wajib: 0, sukarela: 0 },
  );

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const { error } = await supabase.from("simpanan").insert({
        user_id: user!.id,
        jenis: parsed.jenis,
        nominal: parsed.nominal,
        catatan: parsed.catatan || null,
        bukti_url: parsed.bukti_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Simpanan diajukan", { description: "Menunggu verifikasi pengurus." });
      setOpen(false);
      setForm({ jenis: "wajib", nominal: "", catatan: "", bukti_url: "" });
      qc.invalidateQueries({ queryKey: ["simpanan"] });
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
          <h1 className="text-2xl font-bold tracking-tight">Simpanan Saya</h1>
          <p className="text-sm text-muted-foreground">Riwayat simpanan pokok, wajib, dan sukarela.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Setor Simpanan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Setor Simpanan</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Jenis Simpanan</Label>
                <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v as typeof form.jenis })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pokok">Pokok</SelectItem>
                    <SelectItem value="wajib">Wajib</SelectItem>
                    <SelectItem value="sukarela">Sukarela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nominal (IDR)</Label>
                <Input type="number" min={10000} className="mt-2" placeholder="100000" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
              </div>
              <div>
                <Label>URL Bukti Transfer (opsional)</Label>
                <Input type="url" className="mt-2" placeholder="https://..." value={form.bukti_url} onChange={(e) => setForm({ ...form, bukti_url: e.target.value })} />
              </div>
              <div>
                <Label>Catatan (opsional)</Label>
                <Textarea className="mt-2" rows={3} maxLength={500} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SumCard label="Total Saldo" value={totals.total} highlight />
        <SumCard label="Pokok" value={totals.pokok} />
        <SumCard label="Wajib" value={totals.wajib} />
        <SumCard label="Sukarela" value={totals.sukarela} />
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Riwayat Transaksi</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={PiggyBank} title="Belum ada simpanan" desc="Mulai dengan menyetor simpanan wajib bulanan Anda." />
          ) : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="p-3 text-left">Tanggal</th>
                    <th className="p-3 text-left">Jenis</th>
                    <th className="p-3 text-right">Nominal</th>
                    <th className="p-3 text-left">Catatan</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3">{new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="p-3 capitalize">{r.jenis}</td>
                      <td className="p-3 text-right font-medium">{fmt.format(Number(r.nominal))}</td>
                      <td className="p-3 text-muted-foreground">{r.catatan ?? "—"}</td>
                      <td className="p-3"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SumCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card style={{ boxShadow: "var(--shadow-card)", ...(highlight ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)" } : {}) }}>
      <CardContent className="p-5">
        <p className={`text-sm ${highlight ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight">{fmt.format(value)}</p>
      </CardContent>
    </Card>
  );
}
