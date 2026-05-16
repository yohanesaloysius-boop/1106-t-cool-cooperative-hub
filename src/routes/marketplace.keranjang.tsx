import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { cartItemEffectivePrice, useCart } from "@/lib/cart";
import { fmtIDR } from "@/lib/marketplace-api";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

export const Route = createFileRoute("/marketplace/keranjang")({
  head: () => ({ meta: [{ title: "Keranjang — Marketplace T-COOL" }] }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();

  // Group by store
  const groups = cart.items.reduce<Record<string, typeof cart.items>>((acc, it) => {
    (acc[it.store_id] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pt-6 pb-16">
        <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Lanjut Belanja
        </Link>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Keranjang Belanja</h1>

        {cart.items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Keranjang Anda masih kosong.</p>
            <Link to="/marketplace">
              <Button className="mt-4 rounded-full">Mulai Belanja</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-8">
              {Object.entries(groups).map(([storeId, items]) => (
                <div
                  key={storeId}
                  className="rounded-3xl border border-border bg-card p-4 md:p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">🏪 {items[0].store_nama}</p>
                    <button
                      onClick={() => cart.clearStore(storeId)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Hapus semua
                    </button>
                  </div>
                  <div className="space-y-3">
                    {items.map((it) => {
                      const eff = cartItemEffectivePrice(it);
                      return (
                        <div key={it.product_id} className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                            {it.gambar && <img src={it.gambar} alt={it.nama_produk} className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-medium">{it.nama_produk}</p>
                            <p className="text-sm font-bold text-primary">{fmtIDR(eff)}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="inline-flex items-center rounded-full border border-border">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => cart.setQty(it.product_id, it.qty - 1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-xs font-semibold">{it.qty}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => cart.setQty(it.product_id, it.qty + 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => cart.remove(it.product_id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold">{fmtIDR(eff * it.qty)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-4">
              <div
                className="sticky top-24 rounded-3xl border border-border bg-card p-5"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <h2 className="text-base font-semibold">Ringkasan</h2>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Jumlah barang</span>
                  <span className="font-semibold">{cart.count}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{fmtIDR(cart.total)}</span>
                </div>
                <div className="mt-3 border-t border-border pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">{fmtIDR(cart.total)}</span>
                </div>
                <Link to="/marketplace/checkout">
                  <Button className="mt-4 w-full rounded-full">Checkout</Button>
                </Link>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Pembayaran & pengiriman dikonfirmasi via WhatsApp ke masing-masing penjual.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
