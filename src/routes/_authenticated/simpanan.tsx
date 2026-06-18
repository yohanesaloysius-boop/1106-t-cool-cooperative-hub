import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, PiggyBank, Loader2, CalendarClock, TrendingUp, Download, QrCode, Clock, Copy, Landmark, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { FileUpload } from "@/components/file-upload";
import { downloadBuktiSimpanan } from "@/lib/bukti-pdf";
import { RequiredMark } from "@/components/ui/required-mark";

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

const DUMMY_ACCOUNTS = [
  { bank: "CIMB Niaga", no: "7059 7764 0990", atas_nama: "Koperasi T-COOL" },
];

function SimpananPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ jenis: "wajib" as Jenis, nominal: "", tenor_bulan: "12", catatan: "", bukti_url: "" });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"transfer" | "qris">("transfer");
  const [activeQr, setActiveQr] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [creatingQr, setCreatingQr] = useState(false);

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
        const parsed = simpananSchema.parse({ ...form, jenis: form.jenis as any });
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

  const generateQris = async () => {
    if (!user) return;
    if (!form.nominal || Number(form.nominal) < 1000) return toast.error("Nominal minimal Rp 1.000");
    if (form.jenis === "tabungan_berjangka") return toast.error("QRIS hanya untuk simpanan pokok/wajib/sukarela");

    setCreatingQr(true);
    const finalNominal = Number(form.nominal);
    const kett = `Setor simpanan ${form.jenis}`;
    const qrPayload = `00020101021126620014ID.TCOOL.QRIS01189360000${user.id.slice(0, 12)}0303UMI51440014ID.CO.QRIS.WWW0215ID20232556012345303UMI5204549953033605802ID5912TCOOL KOPERAS6007JAKARTA61051234062${String(finalNominal).length + 9}07${finalNominal}6304`;

    // 1) Buat baris simpanan pending agar tercatat di Riwayat Transaksi
    const { data: simp, error: simpErr } = await supabase.from("simpanan").insert({
      user_id: user.id,
      jenis: form.jenis,
      nominal: finalNominal,
      catatan: form.catatan || `Pembayaran via QRIS`,
      bukti_url: null,
    }).select().single();

    if (simpErr) {
      setCreatingQr(false);
      console.error("simpanan insert (qris)", simpErr);
      return toast.error("Gagal membuat tagihan simpanan. Silakan coba lagi.");
    }

    // 2) Buat QRIS payment yang ditautkan ke simpanan tadi
    const { data, error } = await supabase.from("qris_payments").insert({
      user_id: user.id,
      jenis: "simpanan",
      nominal: finalNominal,
      qr_string: qrPayload,
      keterangan: kett,
      ref_id: simp?.id ?? null,
      ref_table: "simpanan",
      metadata: { jenis_simpanan: form.jenis },
    }).select().single();

    setCreatingQr(false);
    if (error) {
      console.error("qris_payments insert", error);
      return toast.error("Gagal membuat QRIS. Silakan coba lagi.");
    }

    const row = data as any;
    setActiveQr(row);
    qc.invalidateQueries({ queryKey: ["qris", user.id] });
    qc.invalidateQueries({ queryKey: ["simpanan"] });
    toast.success(`QRIS ${row.invoice_no} dibuat — berlaku 15 menit`);
  };

  useEffect(() => {
    if (!activeQr) { setQrDataUrl(""); return; }
    QRCode.toDataURL(activeQr.qr_string, { width: 280, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } }).then(setQrDataUrl);
  }, [activeQr]);

  const countdown = useCountdown(activeQr?.expired_at);

  const isTabjangka = form.jenis === "tabungan_berjangka";
  const showTransfer = isTabjangka || payMethod === "transfer";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simpanan Saya</h1>
          <p className="text-sm text-muted-foreground">Pokok, wajib, sukarela, dan tabungan berjangka.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPayingId(null); setPayMethod("transfer"); setActiveQr(null); setQrDataUrl(""); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setPayingId(null); setPayMethod("transfer"); setActiveQr(null); setForm({ jenis: "wajib", nominal: "", tenor_bulan: "12", catatan: "", bukti_url: "" }); }}><Plus className="mr-2 h-4 w-4" />Setor Simpanan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{payingId ? "Bayar Tagihan Simpanan" : "Setor Simpanan"}</DialogTitle>
              <DialogDescription>
                {payingId
                  ? "Unggah bukti transfer untuk tagihan simpanan ini."
                  : "Pilih jenis simpanan, isi nominal, lalu bayar via transfer bank atau QRIS."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Jenis Simpanan<RequiredMark /></Label>
                <Select value={form.jenis} onValueChange={(v) => { setForm({ ...form, jenis: v as Jenis }); setActiveQr(null); }} disabled={!!payingId}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pokok">Pokok</SelectItem>
                    <SelectItem value="wajib">Wajib</SelectItem>
                    <SelectItem value="sukarela">Sukarela</SelectItem>
                    {!payingId && <SelectItem value="tabungan_berjangka">Tabungan Berjangka</SelectItem>}
                  </SelectContent>
                </Select>
                {payingId && <p className="mt-1 text-[11px] text-muted-foreground">Jenis tidak bisa diubah untuk tagihan ini.</p>}
              </div>

              {isTabjangka && (
                <div>
                  <Label>Tenor<RequiredMark /></Label>
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
                <Label>Nominal (IDR)<RequiredMark /></Label>
                <Input type="number" min={isTabjangka ? 1_000_000 : 10_000} className="mt-2" placeholder={isTabjangka ? "5000000" : "100000"} value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
              </div>

              {isTabjangka && nominalNum > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="text-muted-foreground">Estimasi bagi hasil total</p>
                  <p className="text-lg font-bold text-primary">{fmt.format(estimasi)}</p>
                  <p className="text-xs text-muted-foreground">Total saat jatuh tempo: {fmt.format(nominalNum + estimasi)}</p>
                </div>
              )}

              {!isTabjangka && !payingId && (
                <Tabs value={payMethod} onValueChange={(v) => { setPayMethod(v as "transfer" | "qris"); setActiveQr(null); }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="transfer"><Landmark className="mr-1.5 h-4 w-4" />Transfer Bank</TabsTrigger>
                    <TabsTrigger value="qris"><QrCode className="mr-1.5 h-4 w-4" />QRIS</TabsTrigger>
                  </TabsList>

                  <TabsContent value="transfer" className="mt-4 space-y-4">
                    <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Rekening Koperasi T-COOL (Transfer ke sini)</p>
                      {DUMMY_ACCOUNTS.map((acc) => (
                        <div key={acc.bank} className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold">{acc.bank} <span className="text-xs font-normal text-muted-foreground">— {acc.atas_nama}</span></p>
                            <p className="font-mono text-sm">{acc.no}</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(acc.no.replace(/ /g, "")); toast.success(`Nomor ${acc.bank} disalin`); }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

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

                    <div>
                      <Label>Catatan (opsional)</Label>
                      <Textarea className="mt-2" rows={3} maxLength={500} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
                    </div>
                  </TabsContent>

                  <TabsContent value="qris" className="mt-4 space-y-4">
                    {!activeQr ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                          <p className="font-medium">Bayar via QRIS</p>
                          <p className="text-muted-foreground">Klik tombol di bawah untuk membuat kode QRIS. Scan dengan aplikasi e-wallet atau m-banking Anda.</p>
                        </div>
                        <Button onClick={generateQris} disabled={creatingQr || !form.nominal} className="w-full">
                          {creatingQr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                          Generate QRIS
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl bg-gradient-to-br from-primary/5 via-white to-primary/10 p-4 text-center">
                          <p className="text-xs text-muted-foreground">Total Pembayaran</p>
                          <p className="text-3xl font-bold tracking-tight">{fmt.format(Number(activeQr.nominal))}</p>
                          <p className="text-[10px] text-muted-foreground">{activeQr.invoice_no}</p>
                        </div>
                        {activeQr.status === "pending" ? (
                          <>
                            <div className="flex justify-center rounded-xl border-2 border-dashed border-primary/30 bg-white p-4">
                              {qrDataUrl ? <img src={qrDataUrl} alt="QRIS" className="h-56 w-56" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" />Berlaku selama</span>
                              <span className="font-mono font-semibold text-amber-700">{countdown}</span>
                            </div>
                            <p className="text-center text-xs text-muted-foreground">
                              Scan dengan aplikasi e-wallet/m-banking yang mendukung QRIS (GoPay, OVO, DANA, BCA, Mandiri, dll.)
                            </p>
                            <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(activeQr.qr_string); toast.success("Kode QR disalin"); }}>
                              <Copy className="mr-1.5 h-3.5 w-3.5" /> Salin Kode QR
                            </Button>
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveQr(null)}>
                              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Buat QRIS Baru
                            </Button>
                          </>
                        ) : activeQr.status === "success" ? (
                          <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 p-6 text-center">
                            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                            <p className="font-semibold text-emerald-900">Pembayaran Berhasil</p>
                            <p className="text-xs text-emerald-700">Dana telah tercatat di jurnal koperasi.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted p-6 text-center">
                            <XCircle className="h-12 w-12 text-muted-foreground" />
                            <p className="font-semibold capitalize">{activeQr.status}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {(isTabjangka || payingId) && (
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
              )}

              {isTabjangka && (
                <div>
                  <Label>Catatan (opsional)</Label>
                  <Textarea className="mt-2" rows={3} maxLength={500} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
                </div>
              )}
            </div>

            {(isTabjangka || payingId || payMethod === "transfer") && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim
                </Button>
              </DialogFooter>
            )}

            {!isTabjangka && !payingId && payMethod === "qris" && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Rekening Koperasi Info Card */}
      <Card className="border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Rekening Koperasi T-COOL</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {DUMMY_ACCOUNTS.map((acc) => (
              <div key={acc.bank} className="rounded-lg border bg-background px-3 py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{acc.bank}</p>
                  <p className="font-mono text-sm font-semibold">{acc.no}</p>
                  <p className="text-[10px] text-muted-foreground">{acc.atas_nama}</p>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { navigator.clipboard.writeText(acc.no.replace(/ /g, "")); toast.success(`Nomor ${acc.bank} disalin`); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Transfer sesuai nominal, lalu unggah bukti transfer di menu Setor Simpanan. Atau bayar langsung via QRIS (pilihan dalam dialog Setor Simpanan).</p>
        </CardContent>
      </Card>

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

function useCountdown(targetISO: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetISO) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  return useMemo(() => {
    if (!targetISO) return "—";
    const diff = new Date(targetISO).getTime() - now;
    if (diff <= 0) return "00:00";
    const m = Math.floor(diff / 60000); const s = Math.floor((diff % 60000) / 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [targetISO, now]);
}
