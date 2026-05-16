import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Store as StoreIcon, Package, TrendingUp, Eye, Pencil, Trash2, ShoppingBag } from "lucide-react";
import { fmtIDR, PRODUCTS, STORES } from "@/lib/marketplace-mock";

export const Route = createFileRoute("/_authenticated/marketplace-saya")({
  component: MarketplaceSayaPage,
});

function MarketplaceSayaPage() {
  // UI-only seller state (belum disimpan ke DB)
  const [isSeller, setIsSeller] = useState(false);

  // Demo: anggap toko pertama milik user
  const tokoSaya = STORES[0];
  const produkSaya = PRODUCTS.filter((p) => p.toko_slug === tokoSaya.slug);

  if (!isSeller) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          className="rounded-3xl border border-border bg-card p-8 text-center md:p-12"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-primary-foreground shadow-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <StoreIcon className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Buka Toko di Marketplace</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Jadilah seller di Marketplace Komunitas T-COOL. Tampilkan produk & jasa kamu
            ke ratusan anggota koperasi. Gratis, tanpa potongan listing.
          </p>
          <Button size="lg" className="mt-6 rounded-full" onClick={() => setIsSeller(true)}>
            <StoreIcon className="mr-2 h-4 w-4" /> Buka Toko Saya
          </Button>
          <Link to="/marketplace">
            <Button variant="outline" size="lg" className="ml-2 rounded-full">
              <ShoppingBag className="mr-2 h-4 w-4" /> Lihat Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalTerjual = produkSaya.reduce((s, p) => s + p.terjual, 0);
  const totalPendapatan = produkSaya.reduce((s, p) => s + p.terjual * p.harga, 0);

  const stats = [
    { label: "Produk Aktif", value: produkSaya.length.toString(), icon: Package, tint: "from-sky-300 to-blue-500" },
    { label: "Total Terjual", value: totalTerjual.toLocaleString("id-ID"), icon: TrendingUp, tint: "from-emerald-300 to-emerald-500" },
    { label: "Pendapatan", value: fmtIDR(totalPendapatan), icon: ShoppingBag, tint: "from-amber-300 to-orange-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header toko */}
      <div
        className="overflow-hidden rounded-3xl border border-border bg-card"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="relative h-32 md:h-40">
          <img src={tokoSaya.cover} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="-mt-10 flex flex-col gap-3 p-5 md:flex-row md:items-end md:p-6">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-md">
            <img src={tokoSaya.logo} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold md:text-2xl">{tokoSaya.nama}</h1>
            <p className="text-xs text-muted-foreground">{tokoSaya.kota} · Aktif</p>
            <Badge variant="secondary" className="mt-2 rounded-full">Seller Verified</Badge>
          </div>
          <div className="flex gap-2">
            <Link to="/marketplace/toko/$slug" params={{ slug: tokoSaya.slug }}>
              <Button variant="outline" className="rounded-full"><Eye className="mr-2 h-4 w-4" /> Lihat Toko</Button>
            </Link>
            <Button className="rounded-full"><Pencil className="mr-2 h-4 w-4" /> Edit Toko</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold tabular-nums">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Produk Saya */}
      <div
        className="rounded-3xl border border-border bg-card p-5 md:p-6"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Produk Saya</h2>
            <p className="text-xs text-muted-foreground">Kelola produk yang dijual</p>
          </div>
          <Button className="rounded-full"><Plus className="mr-2 h-4 w-4" /> Tambah Produk</Button>
        </div>

        <div className="space-y-3">
          {produkSaya.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <img src={p.gambar} alt={p.nama} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.nama}</p>
                <p className="text-sm font-bold text-primary">{fmtIDR(p.harga)}</p>
                <p className="text-[11px] text-muted-foreground">Stok {p.stok} · {p.terjual} terjual</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
