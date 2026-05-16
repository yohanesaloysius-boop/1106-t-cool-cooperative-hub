import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus, Store as StoreIcon, Package, TrendingUp, Eye, Pencil, Trash2, ShoppingBag,
  Wallet, Megaphone, Phone, MapPin, Sparkles, Instagram, Facebook, Music2, Star, Percent,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  fmtIDR, getMyStore, listStoreProducts, listCategories, listMySales,
  updateStore, deleteProduct, updateProduct, uploadMarketplaceFile, type DbProduct,
} from "@/lib/marketplace-api";
import { ProductFormDialog } from "@/components/marketplace/product-form-dialog";
import { StoreFormDialog } from "@/components/marketplace/store-form-dialog";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/marketplace-saya")({
  component: MarketplaceSayaPage,
});

function MarketplaceSayaPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const storeQ = useQuery({
    queryKey: ["mp-my-store", userId],
    queryFn: () => getMyStore(userId),
    enabled: !!userId,
  });
  const store = storeQ.data;

  const productsQ = useQuery({
    queryKey: ["mp-my-products", store?.id],
    queryFn: () => listStoreProducts(store!.id),
    enabled: !!store?.id,
  });
  const products = productsQ.data ?? [];

  const salesQ = useQuery({
    queryKey: ["mp-my-sales", userId],
    queryFn: () => listMySales(userId),
    enabled: !!userId && !!store,
  });
  const sales = salesQ.data ?? [];

  const categoriesQ = useQuery({ queryKey: ["mp-categories"], queryFn: listCategories });

  const [storeOpen, setStoreOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DbProduct | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DbProduct | null>(null);

  // ===== Empty state =====
  if (storeQ.isLoading) {
    return <div className="mx-auto max-w-2xl"><Skeleton className="h-64 rounded-3xl" /></div>;
  }

  if (!store) {
    return (
      <>
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-border bg-card p-8 text-center md:p-12" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-primary-foreground shadow-lg" style={{ background: "var(--gradient-primary)" }}>
              <StoreIcon className="h-10 w-10" />
            </div>
            <h1 className="mt-5 text-2xl font-bold">Buka Toko di Marketplace</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Halo {profile?.nama_lengkap?.split(" ")[0] || "Anggota"}, jadilah seller di Marketplace Komunitas T-COOL.
              Gratis, tanpa potongan listing. Cukup sekali klik — toko langsung aktif.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button size="lg" className="rounded-full" onClick={() => setStoreOpen(true)}>
                <StoreIcon className="mr-2 h-4 w-4" /> Buka Toko Saya
              </Button>
              <Link to="/marketplace">
                <Button variant="outline" size="lg" className="rounded-full">
                  <ShoppingBag className="mr-2 h-4 w-4" /> Lihat Marketplace
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <StoreFormDialog
          open={storeOpen}
          onOpenChange={setStoreOpen}
          userId={userId}
          onSaved={() => qc.invalidateQueries({ queryKey: ["mp-my-store"] })}
        />
      </>
    );
  }

  // ===== Stats =====
  const totalProduk = products.length;
  const totalTransaksi = sales.length;
  const totalTerjual = sales.filter((s: any) => s.status === "completed").reduce((sum: number, s: any) => sum + s.qty, 0);
  const totalPendapatan = sales.filter((s: any) => s.status === "completed").reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const totalViews = products.reduce((sum, p) => sum + (Number((p as any).view_count) || 0), 0);
  const featuredProducts = products.filter((p) => (p as any).is_featured);

  const stats = [
    { label: "Total Produk", value: totalProduk.toString(), icon: Package, tint: "from-sky-300 to-blue-500" },
    { label: "Transaksi", value: totalTransaksi.toString(), icon: ShoppingBag, tint: "from-violet-300 to-fuchsia-500" },
    { label: "Total Dilihat", value: totalViews.toLocaleString("id-ID"), icon: Eye, tint: "from-rose-300 to-pink-500" },
    { label: "Pendapatan", value: fmtIDR(totalPendapatan), icon: Wallet, tint: "from-amber-300 to-orange-500" },
  ];

  // Sales chart — last 14 days
  const chartData = (() => {
    const map = new Map<string, { hari: string; pendapatan: number; transaksi: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      map.set(key, { hari: label, pendapatan: 0, transaksi: 0 });
    }
    for (const s of sales as any[]) {
      const key = String(s.created_at).slice(0, 10);
      const row = map.get(key);
      if (row) {
        row.transaksi += 1;
        if (s.status === "completed") row.pendapatan += Number(s.total) || 0;
      }
    }
    return Array.from(map.values());
  })();

  async function toggleStoreStatus(active: boolean) {
    try {
      await updateStore(store!.id, { status_toko: active ? "active" : "inactive" });
      toast.success(active ? "Toko diaktifkan" : "Toko dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["mp-my-store"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleProductStatus(p: DbProduct, active: boolean) {
    try {
      await updateProduct(p.id, { status_produk: active ? "active" : "draft" });
      qc.invalidateQueries({ queryKey: ["mp-my-products"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteProduct(confirmDelete.id);
      toast.success("Produk dihapus");
      qc.invalidateQueries({ queryKey: ["mp-my-products"] });
    } catch (e: any) { toast.error(e.message); }
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-6">
      {/* Header toko */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 md:h-44">
          {store.banner ? (
            <img src={store.banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Banner belum diupload</div>
          )}
        </div>
        <div className="-mt-12 flex flex-col gap-3 p-5 md:flex-row md:items-end md:p-6">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-md">
            {store.logo ? (
              <img src={store.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center"><StoreIcon className="h-8 w-8 text-muted-foreground" /></div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold md:text-2xl">{store.nama_toko}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {store.alamat && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{store.alamat}</span>}
              {store.whatsapp && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{store.whatsapp}</span>}
              {(store as any).instagram && <a href={`https://instagram.com/${(store as any).instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-pink-500"><Instagram className="h-3 w-3" />{(store as any).instagram}</a>}
              {(store as any).facebook && <a href={`https://facebook.com/${(store as any).facebook}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-blue-600"><Facebook className="h-3 w-3" />{(store as any).facebook}</a>}
              {(store as any).tiktok && <a href={`https://tiktok.com/@${(store as any).tiktok.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" />{(store as any).tiktok}</a>}
              {(store as any).shopee && <a href={`https://shopee.co.id/${(store as any).shopee}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-orange-500"><ShoppingBag className="h-3 w-3" />{(store as any).shopee}</a>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={store.status_toko === "active" ? "default" : "secondary"} className="rounded-full">
                {store.status_toko === "active" ? "● Aktif" : "○ Nonaktif"}
              </Badge>
              <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                <Switch checked={store.status_toko === "active"} onCheckedChange={toggleStoreStatus} id="status-toko" />
                <Label htmlFor="status-toko" className="cursor-pointer text-xs">Toko Aktif</Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/marketplace/toko/$slug" params={{ slug: store.slug }}>
              <Button variant="outline" className="rounded-full"><Eye className="mr-2 h-4 w-4" /> Lihat Toko</Button>
            </Link>
            <Button className="rounded-full" onClick={() => setStoreOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Profil
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="truncate text-lg font-bold tabular-nums">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      <div className="rounded-3xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-500 text-white shadow-md">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">Statistik Penjualan</h2>
            <p className="text-xs text-muted-foreground">14 hari terakhir · {totalTerjual} item terjual total</p>
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hari" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                formatter={(v: any, name) => name === "pendapatan" ? fmtIDR(Number(v)) : v}
              />
              <Area type="monotone" dataKey="pendapatan" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="produk" className="space-y-4">
        <TabsList className="rounded-full">
          <TabsTrigger value="produk" className="rounded-full"><Package className="mr-2 h-4 w-4" />Produk</TabsTrigger>
          <TabsTrigger value="transaksi" className="rounded-full"><ShoppingBag className="mr-2 h-4 w-4" />Transaksi</TabsTrigger>
          <TabsTrigger value="promo" className="rounded-full"><Megaphone className="mr-2 h-4 w-4" />Promo</TabsTrigger>
        </TabsList>

        {/* PRODUK */}
        <TabsContent value="produk" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Kelola Produk</h2>
                <p className="text-xs text-muted-foreground">Tambah, edit, atau hapus produk yang kamu jual</p>
              </div>
              <Button className="rounded-full" onClick={() => { setEditingProduct(null); setProductOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Produk
              </Button>
            </div>

            {productsQ.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">Belum ada produk</p>
                <p className="text-xs text-muted-foreground">Klik "Tambah Produk" untuk mulai berjualan</p>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {p.gambar_produk?.[0] ? (
                        <img src={p.gambar_produk[0]} alt={p.nama_produk} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.nama_produk}</p>
                      <p className="text-sm font-bold text-primary">{fmtIDR(Number(p.harga))}</p>
                      <p className="text-[11px] text-muted-foreground">Stok {p.stok} · {p.status_produk}</p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <Switch
                        checked={p.status_produk === "active"}
                        onCheckedChange={(v) => toggleProductStatus(p, v)}
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(p); setProductOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TRANSAKSI */}
        <TabsContent value="transaksi">
          <div className="rounded-3xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <h2 className="mb-4 text-lg font-bold">Transaksi Masuk</h2>
            {salesQ.isLoading ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : sales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm">Belum ada transaksi</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sales.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.marketplace_products?.nama_produk}</p>
                      <p className="text-xs text-muted-foreground">{t.qty} × {fmtIDR(Number(t.harga_satuan))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{fmtIDR(Number(t.total))}</p>
                      <Badge variant="secondary" className="rounded-full text-[10px]">{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* PROMO */}
        <TabsContent value="promo">
          <div className="rounded-3xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="mb-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold">Promo & Produk Unggulan</h2>
                <p className="text-xs text-muted-foreground">Fitur promo (diskon, banner, produk unggulan) segera hadir.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              🎁 Promo, diskon, dan produk unggulan akan tersedia di update berikutnya.
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <StoreFormDialog
        open={storeOpen}
        onOpenChange={setStoreOpen}
        userId={userId}
        store={store}
        onSaved={() => qc.invalidateQueries({ queryKey: ["mp-my-store"] })}
      />
      {store && (
        <ProductFormDialog
          open={productOpen}
          onOpenChange={setProductOpen}
          storeId={store.id}
          userId={userId}
          categories={categoriesQ.data ?? []}
          product={editingProduct}
          onSaved={() => qc.invalidateQueries({ queryKey: ["mp-my-products"] })}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus produk?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.nama_produk}" akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
