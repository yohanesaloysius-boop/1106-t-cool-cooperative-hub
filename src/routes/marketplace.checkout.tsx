import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { cartItemEffectivePrice, useCart, type CartItem } from "@/lib/cart";
import { createTransaction, fmtIDR } from "@/lib/marketplace-api";
import { getMarketplaceRekening } from "@/lib/escrow-api";
import { ArrowLeft, CheckCircle2, Copy, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Marketplace T-COOL" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const cart = useCart();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const groups = cart.items.reduce<Record<string, CartItem[]>>((acc, it) => {
    (acc[it.store_id] ||= []).push(it);
    return acc;
  }, {});

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold">Anda harus login untuk checkout.</p>
          <Link to="/auth">
            <Button className="mt-4 rounded-full">Login / Daftar</Button>
          </Link>
        </main>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold">Keranjang kosong.</p>
          <Link to="/marketplace">
            <Button className="mt-4 rounded-full">Belanja Sekarang</Button>
          </Link>
        </main>
      </div>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      for (const [storeId, items] of Object.entries(groups)) {
        const catatan = notes[storeId]?.trim() || undefined;
        for (const it of items) {
          await createTransaction({
            buyer_id: user.id,
            product_id: it.product_id,
            qty: it.qty,
            catatan,
          });
        }
      }
      cart.clear();
      toast.success("Pesanan dibuat! Lanjut transfer ke rekening koperasi & upload bukti.");
      navigate({ to: "/transaksi-saya" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pt-6 pb-16">
        <Link to="/marketplace/keranjang" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Keranjang
        </Link>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Checkout</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            <div className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <h2 className="text-base font-semibold">Pembeli</h2>
              <p className="mt-1 text-sm">{profile?.nama_lengkap ?? user.email}</p>
              <p className="text-xs text-muted-foreground">{profile?.no_hp ?? ""}</p>
            </div>

            {Object.entries(groups).map(([storeId, items]) => {
              const subtotal = items.reduce((s, it) => s + cartItemEffectivePrice(it) * it.qty, 0);
              return (
                <div key={storeId} className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                  <p className="mb-2 text-sm font-semibold">🏪 {items[0].store_nama}</p>
                  <div className="space-y-2 text-sm">
                    {items.map((it) => (
                      <div key={it.product_id} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {it.nama_produk} <span className="text-foreground">x{it.qty}</span>
                        </span>
                        <span className="font-semibold">{fmtIDR(cartItemEffectivePrice(it) * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-border pt-3">
                    <span className="text-sm font-semibold">Subtotal toko</span>
                    <span className="font-bold">{fmtIDR(subtotal)}</span>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Catatan untuk {items[0].store_nama}
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="Mis. ukuran, warna, alamat pengiriman, dll."
                      value={notes[storeId] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [storeId]: e.target.value }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary">
                <Landmark className="h-4 w-4" />
                <p className="text-sm font-bold">Rekening Koperasi</p>
              </div>
              <RekeningInfo />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Transfer ke rekening koperasi → upload bukti di halaman <strong>Transaksi Saya</strong>. Dana ditahan koperasi (escrow) sampai Anda konfirmasi barang diterima.
              </p>
            </div>

            <div className="sticky top-24 rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <h2 className="text-base font-semibold">Total Pembayaran</h2>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Total barang</span>
                <span className="font-semibold">{cart.count}</span>
              </div>
              <div className="mt-3 border-t border-border pt-3 flex justify-between">
                <span className="font-semibold">Total Transfer</span>
                <span className="text-lg font-bold text-primary">{fmtIDR(cart.total)}</span>
              </div>
              <Button className="mt-4 w-full rounded-full" onClick={submit} disabled={submitting}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {submitting ? "Memproses…" : "Buat Pesanan (Bayar via Koperasi)"}
              </Button>
              <p className="mt-3 inline-flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3 w-3 text-primary" />
                Sistem escrow: dana ditahan koperasi sampai barang diterima. Aman untuk pembeli &amp; penjual.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function RekeningInfo() {
  const { data } = useQuery({ queryKey: ["mp-rekening"], queryFn: getMarketplaceRekening });
  if (!data) return <p className="mt-2 text-xs text-muted-foreground">Memuat…</p>;
  return (
    <div className="mt-2 space-y-1 text-sm">
      <p><strong>{data.bank}</strong></p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-base">{data.no_rek}</span>
        <Button size="sm" variant="ghost" className="h-7 rounded-full px-2"
          onClick={() => { navigator.clipboard.writeText(data.no_rek); toast.success("Disalin"); }}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">a.n. {data.atas_nama}</p>
    </div>
  );
}

