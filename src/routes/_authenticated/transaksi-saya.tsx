import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fmtIDR, listMyPurchases } from "@/lib/marketplace-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/transaksi-saya")({
  component: TransaksiSayaPage,
});

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu Konfirmasi", cls: "bg-warning/15 text-foreground" },
  confirmed: { label: "Dikonfirmasi", cls: "bg-primary/15 text-primary" },
  paid: { label: "Sudah Bayar", cls: "bg-primary/15 text-primary" },
  shipped: { label: "Dikirim", cls: "bg-primary/15 text-primary" },
  completed: { label: "Selesai", cls: "bg-success/15 text-success" },
  cancelled: { label: "Dibatalkan", cls: "bg-destructive/15 text-destructive" },
};

function TransaksiSayaPage() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["mp-purchases", user?.id],
    queryFn: () => (user ? listMyPurchases(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Transaksi Saya</h1>
        <p className="text-sm text-muted-foreground">Riwayat pembelian Anda di Marketplace Komunitas.</p>
      </div>

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
          {data.map((t: any) => {
            const st = STATUS_LABEL[t.status] ?? { label: t.status, cls: "bg-muted" };
            const prod = t.marketplace_products;
            const img = Array.isArray(prod?.gambar_produk) ? prod.gambar_produk[0] : undefined;
            return (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={`rounded-full ${st.cls}`}>{st.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold">{prod?.nama_produk ?? "Produk"}</p>
                  <p className="text-xs text-muted-foreground">Qty: {t.qty} · {fmtIDR(Number(t.harga_satuan))}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm font-bold text-primary">{fmtIDR(Number(t.total))}</p>
                  <Link to="/marketplace/produk/$id" params={{ id: t.product_id }}>
                    <Button size="sm" variant="outline" className="rounded-full">Beri Ulasan</Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
