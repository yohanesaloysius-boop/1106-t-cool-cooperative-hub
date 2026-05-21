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
import { Badge } from "@/components/ui/badge";
import { Plus, PiggyBank, Loader2, CalendarClock, TrendingUp, Download } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { FileUpload } from "@/components/file-upload";
import { downloadBuktiSimpanan } from "@/lib/bukti-pdf";

export const Route = createFileRoute("/_authenticated/simpanan")({
  head: () => ({ meta: [{ title: "Simpanan Saya — T-COOL Koperasi" }] }),
  component: SimpananPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const TENOR_BUNGA: Record<number, number> = { 3: 0.4, 6: 0.5, 12: 0.6, 24: 0.75 };

type Jenis = "pokok" | "wajib" | "sukarela" | "tabungan_berjangka";

const simpananSchema = z.object({
  jenis: z.enum(["pokok", "wajib", "sukarela"]),
  nominal: z.coerce.number().min(10_000, "Minimal Rp 10.000").max(1_000_000_000, "Terlalu besar"),
  catatan: z.string().trim().max(500).optional(),
  bukti_url: z.string().trim().min(1, "Bukti transfer wajib diunggah").max(500),
});

const tabjangkaSchema = z.object({
  nominal: z.coerce.number().min(1_000_000, "Minimal Rp 1.000.000"),
  tenor_bulan: z.coerce.number().refine((v) => [3, 6, 12, 24].includes(v), "Tenor 3/6/12/24 bulan"),
  bukti_url: z.string().min(1, "Bukti transfer wajib"),
});

function SimpananPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ jenis: "wajib" as Jenis, nominal: "", tenor_bulan: "12", catatan: "", bukti_url: "" });
  const [payingId, setPayingId] = useState<string | null>(null);

  const openPay = (r: { id: string; jenis: string; nominal: number | string; catatan?: string | null }) => {
    setPayingId(r.id);
    setForm({
      jenis: (r.jenis as Jenis) ?? "pokok",
      nominal: String(r.nominal ?? ""),
      tenor_bulan: "12",
      catatan: r.catatan ?? "",
      bukti_url: "",
    });
    setOpen(true);
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["simpanan", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("simpanan").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tabjangka = [] } = useQuery({
    queryKey: ["tabjangka-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("tabungan_berjangka").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
  const totalTabjangka = tabjangka.filter((r) => r.status === "active" || r.status === "matured").reduce((a, b) => a + Number(b.nominal), 0);

  const tenor = Number(form.tenor_bulan);
  const bunga = TENOR_BUNGA[tenor] ?? 0.5;
  const nominalNum = Number(form.nominal) || 0;
  const estimasi = nominalNum * (bunga / 100) * tenor;

  const create = useMutation({
    mutationFn: async () => {
      if (form.jenis === "tabungan_berjangka") {
        const parsed = tabjangkaSchema.parse({ nominal: form.nominal, tenor_bulan: tenor, bukti_url: form.bukti_url });
        const { error } = await supabase.from("tabungan_berjangka").insert({
          user_id: user!.id,
          nominal: parsed.nominal,
          tenor_bulan: parsed.tenor_bulan,
          bunga_persen: TENOR_BUNGA[parsed.tenor_bulan],
          bukti_url: parsed.bukti_url,
        });
        if (error) throw error;
      } else {
        const parsed = simpananSchema.parse({ ...form, jenis: form.jenis });
        if (payingId) {
          const { error } = await supabase
            .from("simpanan")
            .update({
              nominal: parsed.nominal,
              catatan: parsed.catatan || null,
              bukti_url: parsed.bukti_url || null,
            })
            .eq("id", payingId)
            .eq("user_id", user!.id)
            .eq("status", "pending");
          if (error) throw error;
        } else {
          const { error } = await supabase.from("simpanan").insert({
            user_id: user!.id,
            jenis: parsed.jenis,
            nominal: parsed.nominal,
            catatan: parsed.catatan || null,
            bukti_url: parsed.bukti_url || null,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(payingId ? "Bukti terkirim" : "Pengajuan dikirim", { description: "Menunggu verifikasi pengurus." });
      setOpen(false);
      setPayingId(null);
      setForm({ jenis: "wajib", nominal: "", tenor_bulan: "12", catatan: "", bukti_url: "" });
      qc.invalidateQueries({ queryKey: ["simpanan"] });
      qc.invalidateQueries({ queryKey: ["tabjangka-mine"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error("Gagal", { description: msg });
    },
  });

  const isTabjangka = form.jenis === "tabungan_berjangka";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simpanan Saya</h1>
          <p className="text-sm text-muted-foreground">Pokok, wajib, sukarela, dan tabungan berjangka.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPayingId(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setPayingId(null)}><Plus className="mr-2 h-4 w-4" />Setor Simpanan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{payingId ? "Bayar Tagihan Simpanan" : "Setor Simpanan"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Jenis Simpanan</Label>
                <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v as Jenis })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pokok">Pokok</SelectItem>
                    <SelectItem value="wajib">Wajib</SelectItem>
                    <SelectItem value="sukarela">Sukarela</SelectItem>
                    <SelectItem value="tabungan_berjangka">Tabungan Berjangka</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isTabjangka && (
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
              )}

              <div>
                <Label>Nominal (IDR)</Label>
                <Input type="number" min={isTabjangka ? 1_000_000 : 10_000} className="mt-2" placeholder={isTabjangka ? "5000000" : "100000"} value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
              </div>

              {isTabjangka && nominalNum > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="text-muted-foreground">Estimasi bagi hasil total</p>
                  <p className="text-lg font-bold text-primary">{fmt.format(estimasi)}</p>
                  <p className="text-xs text-muted-foreground">Total saat jatuh tempo: {fmt.format(nominalNum + estimasi)}</p>
                </div>
              )}

              <div>
                <Label className="flex items-center gap-1">
                  Bukti Transfer <span className="text-destructive">*</span>
                </Label>
                <div className="mt-2">
                  <FileUpload
                    bucket="bukti-transfer"
                    userId={user!.id}
                    accept="image/*,application/pdf"
                    label="Unggah bukti transfer"
                    hint="Wajib. Format: gambar atau PDF, maks 4MB."
                    maxMB={4}
                    onUploaded={(res) => setForm({ ...form, bukti_url: res.path })}
                  />
                  {form.bukti_url && <p className="mt-1 text-[11px] text-success">✓ File terunggah</p>}
                </div>
              </div>

              {!isTabjangka && (
                <div>
                  <Label>Catatan (opsional)</Label>
                  <Textarea className="mt-2" rows={3} maxLength={500} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
                </div>
              )}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SumCard label="Total Saldo" value={totals.total} highlight />
        <SumCard label="Pokok" value={totals.pokok} />
        <SumCard label="Wajib" value={totals.wajib} />
        <SumCard label="Sukarela" value={totals.sukarela} />
        <SumCard label="Tabungan Berjangka" value={totalTabjangka} />
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
                    <th className="p-3 text-right">Aksi</th>
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
                      <td className="p-3 text-right">
                        {r.status === "verified" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadBuktiSimpanan({
                                id: r.id,
                                jenis: String(r.jenis),
                                nominal: Number(r.nominal),
                                tanggal: r.created_at,
                                catatan: r.catatan,
                                verified_at: (r as any).verified_at ?? null,
                                anggota: {
                                  nama: profile?.nama_lengkap ?? "—",
                                  nomor: profile?.nomor_anggota ?? null,
                                  email: profile?.email ?? null,
                                },
                              })
                            }
                          >
                            <Download className="mr-1 h-3.5 w-3.5" /> Bukti
                          </Button>
                        ) : r.status === "pending" && !r.bukti_url && (r.jenis === "pokok" || r.jenis === "wajib" || r.jenis === "sukarela") ? (
                          <Button
                            size="sm"
                            onClick={() => openPay({ id: r.id, jenis: String(r.jenis), nominal: Number(r.nominal), catatan: r.catatan })}
                          >
                            Bayar Sekarang
                          </Button>
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

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Tabungan Berjangka</CardTitle>
        </CardHeader>
        <CardContent>
          {tabjangka.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Belum ada tabungan berjangka" desc="Pilih jenis 'Tabungan Berjangka' saat setor simpanan." />
          ) : (
            <ul className="divide-y divide-border">
              {tabjangka.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" /></div>
                    <div>
                      <p className="font-semibold">{fmt.format(Number(r.nominal))}</p>
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
