import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QrCode, Loader2, PiggyBank, Receipt, Wallet, ShoppingBag, CheckCircle2, Clock, XCircle, Copy, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bayar-qris")({
  head: () => ({ meta: [{ title: "Bayar QRIS — T-COOL" }] }),
  component: BayarQRISPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type Jenis = "simpanan" | "angsuran" | "topup" | "marketplace";
type QrisRow = {
  id: string; invoice_no: string; jenis: Jenis; nominal: number; status: string;
  qr_string: string; keterangan: string | null; ref_id: string | null;
  expired_at: string; paid_at: string | null; created_at: string;
};

function statusBadge(s: string) {
  const map: Record<string, { v: any; cls: string; icon: any }> = {
    pending: { v: "outline", cls: "border-amber-500 text-amber-700", icon: Clock },
    success: { v: "default", cls: "bg-emerald-600 hover:bg-emerald-600", icon: CheckCircle2 },
    expired: { v: "secondary", cls: "", icon: XCircle },
    failed: { v: "destructive", cls: "", icon: XCircle },
    cancelled: { v: "secondary", cls: "", icon: XCircle },
  };
  const m = map[s] ?? map.pending;
  const Icon = m.icon;
  return <Badge variant={m.v} className={m.cls}><Icon className="mr-1 h-3 w-3" />{s}</Badge>;
}

function BayarQRISPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [jenis, setJenis] = useState<Jenis>("simpanan");
  const [nominal, setNominal] = useState<string>("");
  const [jenisSimpanan, setJenisSimpanan] = useState<string>("wajib");
  const [angsuranId, setAngsuranId] = useState<string>("");
  const [marketplaceId, setMarketplaceId] = useState<string>("");
  const [keterangan, setKeterangan] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeQr, setActiveQr] = useState<QrisRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useRealtime("qris_payments", () => qc.invalidateQueries({ queryKey: ["qris", user?.id] }), { filter: `user_id=eq.${user?.id}` });

  const history = useQuery({
    queryKey: ["qris", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("qris_payments").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as QrisRow[];
    },
  });

  const angsuranUnpaid = useQuery({
    queryKey: ["qris-angsuran-unpaid", user?.id],
    enabled: !!user && jenis === "angsuran",
    queryFn: async () => {
      const { data } = await supabase.from("angsuran").select("id,cicilan_ke,nominal,jatuh_tempo,pinjaman_id").eq("user_id", user!.id).in("status", ["unpaid", "overdue"]).order("jatuh_tempo");
      return data ?? [];
    },
  });

  const marketplacePending = useQuery({
    queryKey: ["qris-mp-pending", user?.id],
    enabled: !!user && jenis === "marketplace",
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_transactions").select("id,total,qty,product_id,marketplace_products(nama_produk)").eq("buyer_id", user!.id).eq("status", "pending").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Track active QR realtime status from list
  useEffect(() => {
    if (!activeQr || !history.data) return;
    const updated = history.data.find((r) => r.id === activeQr.id);
    if (updated && updated.status !== activeQr.status) {
      setActiveQr(updated);
      if (updated.status === "success") toast.success("Pembayaran berhasil! 🎉");
      else if (updated.status === "expired") toast.error("QRIS kedaluwarsa");
    }
  }, [history.data, activeQr]);

  // Generate QR image when active
  useEffect(() => {
    if (!activeQr) { setQrDataUrl(""); return; }
    QRCode.toDataURL(activeQr.qr_string, { width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } }).then(setQrDataUrl);
  }, [activeQr]);

  const handleCreate = async () => {
    if (!user) return;
    let finalNominal = Number(nominal);
    let ref_id: string | null = null;
    let kett = keterangan || null;
    const metadata: Record<string, any> = {};

    if (jenis === "angsuran") {
      const row = angsuranUnpaid.data?.find((a: any) => a.id === angsuranId);
      if (!row) return toast.error("Pilih cicilan yang akan dibayar");
      finalNominal = Number(row.nominal);
      ref_id = row.id;
      kett = `Bayar cicilan ke-${row.cicilan_ke}`;
    } else if (jenis === "marketplace") {
      const row = marketplacePending.data?.find((m: any) => m.id === marketplaceId);
      if (!row) return toast.error("Pilih pesanan yang akan dibayar");
      finalNominal = Number(row.total);
      ref_id = row.id;
      kett = `Bayar pesanan ${row.marketplace_products?.nama_produk ?? ""}`;
    } else if (jenis === "simpanan") {
      metadata.jenis_simpanan = jenisSimpanan;
      kett = `Setor simpanan ${jenisSimpanan}`;
    } else if (jenis === "topup") {
      kett = "Topup saldo dompet";
    }

    if (!finalNominal || finalNominal < 1000) return toast.error("Nominal minimal Rp 1.000");

    setCreating(true);
    // Generate mock QR string (EMV-like payload — bukan QRIS resmi)
    const qrPayload = `00020101021126620014ID.TCOOL.QRIS01189360000${user.id.slice(0, 12)}0303UMI51440014ID.CO.QRIS.WWW0215ID20232556012345303UMI5204549953033605802ID5912TCOOL KOPERAS6007JAKARTA61051234062${String(finalNominal).length + 9}07${finalNominal}6304`;

    const { data, error } = await supabase.from("qris_payments").insert({
      user_id: user.id, jenis, nominal: finalNominal, qr_string: qrPayload,
      keterangan: kett, ref_id, ref_table: jenis === "angsuran" ? "angsuran" : jenis === "marketplace" ? "marketplace_transactions" : null,
      metadata,
    }).select().single();
    setCreating(false);

    if (error) return toast.error(error.message);
    setActiveQr(data as QrisRow);
    setNominal(""); setKeterangan("");
    qc.invalidateQueries({ queryKey: ["qris", user.id] });
    toast.success(`QRIS ${data.invoice_no} dibuat — berlaku 15 menit`);
  };

  // Simulasi pembayaran khusus pengurus dipindahkan ke /admin/qris.


  const countdown = useCountdown(activeQr?.expired_at);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-white/80"><QrCode className="h-4 w-4" /> Pembayaran QRIS</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold">Bayar Apapun, Sekali Scan</h1>
        <p className="mt-1 text-sm text-white/80">Setoran simpanan, cicilan, topup dompet, atau pesanan marketplace — semua via QRIS.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Buat Pembayaran Baru</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={jenis} onValueChange={(v) => setJenis(v as Jenis)}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="simpanan"><PiggyBank className="mr-1.5 h-4 w-4" />Simpanan</TabsTrigger>
              <TabsTrigger value="angsuran"><Receipt className="mr-1.5 h-4 w-4" />Cicilan</TabsTrigger>
              <TabsTrigger value="topup"><Wallet className="mr-1.5 h-4 w-4" />Topup</TabsTrigger>
              <TabsTrigger value="marketplace"><ShoppingBag className="mr-1.5 h-4 w-4" />Marketplace</TabsTrigger>
            </TabsList>

            <TabsContent value="simpanan" className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Jenis Simpanan</Label>
                  <Select value={jenisSimpanan} onValueChange={setJenisSimpanan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pokok">Simpanan Pokok</SelectItem>
                      <SelectItem value="wajib">Simpanan Wajib</SelectItem>
                      <SelectItem value="sukarela">Simpanan Sukarela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nominal (Rp)</Label>
                  <Input type="number" placeholder="50000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="angsuran" className="mt-4 space-y-3">
              <Label className="text-xs">Pilih Cicilan</Label>
              <Select value={angsuranId} onValueChange={setAngsuranId}>
                <SelectTrigger><SelectValue placeholder={angsuranUnpaid.isLoading ? "Memuat..." : (angsuranUnpaid.data?.length ? "Pilih cicilan yang akan dibayar" : "Tidak ada cicilan tertunggak")} /></SelectTrigger>
                <SelectContent>
                  {angsuranUnpaid.data?.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      Cicilan #{a.cicilan_ke} — {fmt.format(Number(a.nominal))} — JT {new Date(a.jatuh_tempo).toLocaleDateString("id-ID")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="topup" className="mt-4 space-y-3">
              <Label className="text-xs">Nominal Topup (Rp)</Label>
              <Input type="number" placeholder="100000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {[50000, 100000, 250000, 500000, 1000000].map((n) => (
                  <Button key={n} type="button" size="sm" variant="outline" onClick={() => setNominal(String(n))}>{fmt.format(n)}</Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="marketplace" className="mt-4 space-y-3">
              <Label className="text-xs">Pilih Pesanan</Label>
              <Select value={marketplaceId} onValueChange={setMarketplaceId}>
                <SelectTrigger><SelectValue placeholder={marketplacePending.isLoading ? "Memuat..." : (marketplacePending.data?.length ? "Pilih pesanan pending" : "Tidak ada pesanan menunggu bayar")} /></SelectTrigger>
                <SelectContent>
                  {marketplacePending.data?.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.marketplace_products?.nama_produk ?? "Produk"} × {m.qty} — {fmt.format(Number(m.total))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs">Catatan (opsional)</Label>
                <Input placeholder="Catatan transaksi" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full" size="lg">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                Generate QRIS
              </Button>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Histori */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Histori Pembayaran QRIS</CardTitle></CardHeader>
        <CardContent className="p-0">
          {history.isLoading ? (
            <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : !history.data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada transaksi QRIS.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                    <TableCell className="text-xs capitalize">{r.jenis}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt.format(Number(r.nominal))}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => setActiveQr(r)}>Buka QR</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={!!activeQr} onOpenChange={(o) => !o && setActiveQr(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> Pembayaran QRIS</DialogTitle>
            <DialogDescription>{activeQr?.invoice_no} · {activeQr?.keterangan}</DialogDescription>
          </DialogHeader>
          {activeQr && (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-primary/5 via-white to-primary/10 p-4 text-center">
                <p className="text-xs text-muted-foreground">Total Pembayaran</p>
                <p className="text-3xl font-bold tracking-tight">{fmt.format(Number(activeQr.nominal))}</p>
              </div>

              {activeQr.status === "pending" ? (
                <>
                  <div className="flex justify-center rounded-xl border-2 border-dashed border-primary/30 bg-white p-4">
                    {qrDataUrl ? <img src={qrDataUrl} alt="QRIS" className="h-64 w-64" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" />Berlaku selama</span>
                    <span className="font-mono font-semibold text-amber-700">{countdown}</span>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Scan dengan aplikasi e-wallet/m-banking apa pun yang mendukung QRIS (GoPay, OVO, DANA, ShopeePay, BCA, Mandiri, BRI, BNI, dll.)
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(activeQr.qr_string); toast.success("Kode QR disalin"); }}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Salin Kode QR
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground">Setelah Anda membayar, pengurus akan memverifikasi & menandai pembayaran berhasil dalam beberapa menit.</p>

                </>
              ) : activeQr.status === "success" ? (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 p-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                  <p className="font-semibold text-emerald-900">Pembayaran Berhasil</p>
                  <p className="text-xs text-emerald-700">Dana telah tercatat di jurnal koperasi.</p>
                  <Button variant="outline" size="sm" onClick={() => setActiveQr(null)}>Tutup</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-muted p-6 text-center">
                  <XCircle className="h-12 w-12 text-muted-foreground" />
                  <p className="font-semibold capitalize">{activeQr.status}</p>
                  <Button variant="outline" size="sm" onClick={() => setActiveQr(null)}>Tutup</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
