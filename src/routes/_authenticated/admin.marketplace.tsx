import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Eye, Package, Store as StoreIcon, Layers, TrendingUp } from "lucide-react";
import { fmtIDR, PRODUCTS, STORES, CATEGORIES } from "@/lib/marketplace-mock";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({
  component: AdminMarketplacePage,
});

function AdminMarketplacePage() {
  const [tab, setTab] = useState("produk");

  const totalProduk = PRODUCTS.length;
  const totalToko = STORES.length;
  const totalKategori = CATEGORIES.length;
  const totalTerjual = PRODUCTS.reduce((s, p) => s + p.terjual, 0);

  const stats = [
    { label: "Total Produk", value: totalProduk, icon: Package, tint: "from-sky-300 to-blue-500" },
    { label: "Total Toko", value: totalToko, icon: StoreIcon, tint: "from-emerald-300 to-emerald-500" },
    { label: "Kategori", value: totalKategori, icon: Layers, tint: "from-violet-300 to-purple-500" },
    { label: "Total Terjual", value: totalTerjual, icon: TrendingUp, tint: "from-amber-300 to-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Marketplace</h1>
        <p className="text-sm text-muted-foreground">Kelola produk, toko, kategori & moderasi marketplace komunitas.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-xl font-bold tabular-nums">{s.value.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-3xl border border-border bg-card p-5 md:p-6"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-full">
            <TabsTrigger value="produk" className="rounded-full">Produk</TabsTrigger>
            <TabsTrigger value="toko" className="rounded-full">Toko</TabsTrigger>
            <TabsTrigger value="kategori" className="rounded-full">Kategori</TabsTrigger>
            <TabsTrigger value="moderasi" className="rounded-full">Moderasi</TabsTrigger>
          </TabsList>

          {/* PRODUK */}
          <TabsContent value="produk" className="mt-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 pr-3">Produk</th>
                    <th className="py-3 pr-3">Toko</th>
                    <th className="py-3 pr-3">Kategori</th>
                    <th className="py-3 pr-3 text-right">Harga</th>
                    <th className="py-3 pr-3 text-right">Stok</th>
                    <th className="py-3 pr-3 text-right">Terjual</th>
                    <th className="py-3 pr-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTS.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-lg">
                            <img src={p.gambar} alt="" className="h-full w-full object-cover" />
                          </div>
                          <span className="line-clamp-1 font-medium">{p.nama}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">{p.toko_slug}</td>
                      <td className="py-3 pr-3"><Badge variant="secondary" className="rounded-full">{p.kategori}</Badge></td>
                      <td className="py-3 pr-3 text-right font-semibold text-primary tabular-nums">{fmtIDR(p.harga)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{p.stok}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{p.terjual}</td>
                      <td className="py-3 pr-3">
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TOKO */}
          <TabsContent value="toko" className="mt-5">
            <div className="grid gap-3 md:grid-cols-2">
              {STORES.map((s) => (
                <div key={s.slug} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="h-12 w-12 overflow-hidden rounded-xl">
                    <img src={s.logo} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.nama}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.pemilik} · {s.kota}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">Verified</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* KATEGORI */}
          <TabsContent value="kategori" className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {CATEGORIES.map((c) => {
                const count = PRODUCTS.filter((p) => p.kategori === c.slug).length;
                return (
                  <div key={c.slug} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
                    <span className="text-2xl">{c.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{count} produk</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* MODERASI */}
          <TabsContent value="moderasi" className="mt-5">
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-8 text-center">
              <p className="text-sm font-semibold">Antrian Moderasi Produk Baru</p>
              <p className="mt-1 text-xs text-muted-foreground">Belum ada produk yang menunggu persetujuan.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button size="sm" variant="outline" className="rounded-full"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Setujui Semua</Button>
                <Button size="sm" variant="outline" className="rounded-full text-destructive"><XCircle className="mr-1 h-3.5 w-3.5" /> Tolak Semua</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
