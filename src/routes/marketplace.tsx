import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ShoppingCart, Star, UserPlus } from "lucide-react";
import {
  fmtIDR,
  listCategories,
  listProducts,
  listStores,
  type DbCategory,
  type DbProduct,
  type DbStore,
} from "@/lib/marketplace-api";
import { cartItemEffectivePrice, useCart } from "@/lib/cart";

type Search = { kategori?: string };

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace Komunitas — T-COOL Koperasi" },
      { name: "description", content: "Belanja produk & jasa langsung dari anggota koperasi T-COOL. Harga komunitas, kualitas terjamin." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    kategori: typeof search.kategori === "string" ? search.kategori : undefined,
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { kategori } = Route.useSearch();
  const cart = useCart();

  const { data: categories = [] } = useQuery({ queryKey: ["mp-cats"], queryFn: listCategories });
  const { data: stores = [] } = useQuery({ queryKey: ["mp-stores"], queryFn: () => listStores("active") });
  const { data: products = [] } = useQuery({
    queryKey: ["mp-list", kategori ?? null],
    queryFn: () => listProducts({ categorySlug: kategori }),
  });

  const featured = useMemo(() => (products as any[]).filter((p) => p.is_featured).slice(0, 8), [products]);
  const currentCat = categories.find((c) => c.slug === kategori);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Cart floating button */}
      {cart.count > 0 && (
        <Link to="/marketplace/keranjang">
          <Button
            size="lg"
            className="fixed bottom-6 right-6 z-40 rounded-full shadow-xl"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Keranjang ({cart.count})
          </Button>
        </Link>
      )}

      <main className="container mx-auto space-y-12 px-4 pt-6 pb-16 md:pt-8">
        <MarketplaceHero />

        {/* KATEGORI */}
        {categories.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Kategori</h2>
              <p className="text-sm text-muted-foreground">Temukan produk sesuai kebutuhanmu</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/marketplace">
                <Badge variant={!kategori ? "default" : "secondary"} className="rounded-full px-4 py-1.5 cursor-pointer">
                  Semua
                </Badge>
              </Link>
              {categories.map((c: DbCategory) => (
                <Link key={c.slug} to="/marketplace" search={{ kategori: c.slug }}>
                  <Badge
                    variant={kategori === c.slug ? "default" : "secondary"}
                    className="rounded-full px-4 py-1.5 cursor-pointer"
                  >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.nama_kategori}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FEATURED */}
        {featured.length > 0 && !kategori && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">⭐ Produk Unggulan</h2>
              <p className="text-sm text-muted-foreground">Pilihan terbaik dari toko-toko anggota</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {featured.map((p) => (
                <RealProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* TOKO PILIHAN */}
        {stores.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Toko Anggota Pilihan</h2>
              <p className="text-sm text-muted-foreground">Toko-toko aktif dari komunitas T-COOL</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stores.slice(0, 6).map((s: DbStore) => (
                <div
                  key={s.id}
                  className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {s.logo && <img src={s.logo} alt={s.nama_toko} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.nama_toko}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{s.deskripsi}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SEMUA PRODUK / FILTER */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                {currentCat ? `Kategori: ${currentCat.nama_kategori}` : "Semua Produk"}
              </h2>
              <p className="text-sm text-muted-foreground">{products.length} produk tersedia</p>
            </div>
            {kategori && (
              <Link to="/marketplace">
                <Button size="sm" variant="outline" className="rounded-full">Reset filter</Button>
              </Link>
            )}
          </div>
          {products.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Belum ada produk{currentCat ? ` di kategori ${currentCat.nama_kategori}` : ""}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {(products as any[]).map((p) => (
                <RealProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <section
          className="relative overflow-hidden rounded-3xl border border-border p-8 md:p-12"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="relative grid items-center gap-6 md:grid-cols-2">
            <div className="text-primary-foreground">
              <h2 className="text-2xl font-bold leading-tight md:text-3xl">
                Punya usaha? Gabung anggota & buka toko gratis.
              </h2>
              <p className="mt-3 max-w-md text-sm opacity-90 md:text-base">
                Jangkau ratusan anggota koperasi. Tanpa biaya listing, tanpa potongan tersembunyi.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/daftar-anggota">
                <Button size="lg" variant="secondary" className="rounded-full shadow-lg">
                  <UserPlus className="mr-2 h-4 w-4" /> Daftar Anggota
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="rounded-full border-white/40 bg-white/10 text-primary-foreground backdrop-blur hover:bg-white/20 hover:text-primary-foreground">
                  Sudah punya akun? Login <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function RealProductCard({ product }: { product: DbProduct & { marketplace_stores?: any; marketplace_categories?: any } }) {
  const img = Array.isArray(product.gambar_produk) && product.gambar_produk[0]
    ? product.gambar_produk[0]
    : "https://placehold.co/400x400?text=Produk";
  const diskon = product.diskon_persen ?? 0;
  const eff = cartItemEffectivePrice({ harga: Number(product.harga), diskon_persen: diskon });
  return (
    <Link
      to="/marketplace/produk/$id"
      params={{ id: product.id }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img src={img} alt={product.nama_produk} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        {diskon > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-md">
            -{diskon}%
          </span>
        )}
        {product.is_featured && (
          <span className="absolute right-2 top-2 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-warning-foreground shadow-md">
            ⭐
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{product.nama_produk}</h3>
        <div className="flex items-baseline gap-1.5">
          <p className="text-base font-bold text-primary">{fmtIDR(eff)}</p>
          {diskon > 0 && <p className="text-[11px] text-muted-foreground line-through">{fmtIDR(Number(product.harga))}</p>}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>Stok {product.stok}</span>
          <span>·</span>
          <span className="truncate">{product.marketplace_stores?.nama_toko}</span>
        </div>
      </div>
    </Link>
  );
}
