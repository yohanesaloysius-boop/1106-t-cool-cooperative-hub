import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fmtIDR, listMyPurchases } from "@/lib/marketplace-api";
import {
  confirmReceived,
  fileComplaint,
  getMarketplaceRekening,
  uploadBuktiFile,
  uploadBuktiTransfer,
} from "@/lib/escrow-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingBag, Upload, CheckCircle2, Copy, Truck, Hourglass, PackageCheck, Banknote, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transaksi-saya")({
  component: TransaksiSayaPage,
});

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Menunggu Pembayaran", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: Hourglass },
  confirmed: { label: "Bukti Dikirim", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300", icon: Upload },
  paid: { label: "Dana di Escrow", cls: "bg-primary/15 text-primary", icon: Banknote },
  shipped: { label: "Dalam Pengiriman", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300", icon: Truck },
  completed: { label: "Selesai", cls: "bg-success/15 text-success", icon: PackageCheck },
  cancelled: { label: "Dibatalkan", cls: "bg-destructive/15 text-destructive", icon: Hourglass },
};

function TransaksiSayaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["mp-purchases", user?.id],
    queryFn: () => (user ? listMyPurchases(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const rekQ = useQuery({ queryKey: ["mp-rekening"], queryFn: getMarketplaceRekening });

  const refresh = () => qc.invalidateQueries({ queryKey: ["mp-purchases"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Transaksi Saya</h1>
        <p className="text-sm text-muted-foreground">
          Bayar ke rekening koperasi → upload bukti → dana ditahan (escrow) → konfirmasi terima saat barang sampai.
        </p>
      </div>

      {/* Info rekening koperasi */}
      {rekQ.data && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Rekening Koperasi</p>
              <p className="mt-1 text-sm">
                <strong>{rekQ.data.bank}</strong> · <span className="font-mono">{rekQ.data.no_rek}</span> · a.n. {rekQ.data.atas_nama}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(rekQ.data!.no_rek);
                toast.success("Nomor rekening disalin");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Salin No. Rek
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : data.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada transaksi.</p>
          <Link to="/marketplace">
            <Button className="mt-4 rounded-full">Belanja Sekarang</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((t: any) => (
            <TrxRow key={t.id} trx={t} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrxRow({ trx: t, onChanged }: { trx: any; onChanged: () => void }) {
  const { user } = useAuth();
  const st = STATUS_LABEL[t.status] ?? { label: t.status, cls: "bg-muted", icon: Hourglass };
  const Icon = st.icon;
  const prod = t.marketplace_products;
  const img = Array.isArray(prod?.gambar_produk) ? prod.gambar_produk[0] : undefined;
  const [busy, setBusy] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const url = await uploadBuktiFile(user.id, file);
      await uploadBuktiTransfer(t.id, url);
      toast.success("Bukti transfer terkirim. Menunggu verifikasi pengurus.");
      setOpenUpload(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal upload");
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmReceived(t.id);
      toast.success("Pesanan selesai. Dana cair ke saldo penjual.");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal konfirmasi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        {img && <img src={img} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`rounded-full ${st.cls}`}>
            <Icon className="mr-1 h-3 w-3" /> {st.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            #{t.id.slice(0, 8)} ·{" "}
            {new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm font-semibold">{prod?.nama_produk ?? "Produk"}</p>
        <p className="text-xs text-muted-foreground">
          Qty: {t.qty} · {fmtIDR(Number(t.harga_satuan))}
          {t.resi && (
            <>
              {" · "}
              <span className="font-mono">{t.kurir} {t.resi}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <p className="text-sm font-bold text-primary">{fmtIDR(Number(t.total))}</p>

        {t.status === "pending" && (
          <Dialog open={openUpload} onOpenChange={setOpenUpload}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full">
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Bukti
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Bukti Transfer</DialogTitle>
                <DialogDescription>
                  Total bayar: <strong>{fmtIDR(Number(t.total))}</strong>. Upload screenshot bukti transfer ke rekening koperasi.
                </DialogDescription>
              </DialogHeader>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doUpload(f);
                }}
                className="block w-full rounded-lg border border-input bg-background p-2 text-sm"
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenUpload(false)} disabled={busy}>Batal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {(t.status === "paid" || t.status === "shipped") && (
          <Button size="sm" className="rounded-full" onClick={doConfirm} disabled={busy}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Konfirmasi Terima
          </Button>
        )}

        {t.status === "completed" && (
          <Link to="/marketplace/produk/$id" params={{ id: t.product_id }}>
            <Button size="sm" variant="outline" className="rounded-full">Beri Ulasan</Button>
          </Link>
        )}

        {t.bukti_transfer_url && t.status !== "pending" && (
          <a href={t.bukti_transfer_url} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground underline">
            Lihat bukti
          </a>
        )}
      </div>
    </div>
  );
}
