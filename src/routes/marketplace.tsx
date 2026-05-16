import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { ProductCard } from "@/components/marketplace/product-card";
import { StoreCard } from "@/components/marketplace/store-card";
import { CategoryPill } from "@/components/marketplace/category-pill";
import { ProductCarousel } from "@/components/marketplace/product-carousel";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus } from "lucide-react";
import { CATEGORIES, PRODUCTS, STORES, getCategory } from "@/lib/marketplace-mock";

type Search = { kategori?: string };

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace Komunitas — T-COOL Koperasi" },
      { name: "description", content: "Belanja produk & jasa langsung dari anggota koperasi T-COOL. Harga komunitas, kualitas terjamin." },
      { property: "og:title", content: "Marketplace Komunitas — T-COOL Koperasi" },
      { property: "og:description", content: "Marketplace ekslusif anggota koperasi T-COOL: kuliner, fashion, kerajinan, pertanian, dan banyak lagi." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    kategori: typeof search.kategori === "string" ? search.kategori : undefined,
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { kategori } = Route.useSearch();
  const cat = kategori ? getCategory(kategori) : undefined;

  const filtered = useMemo(
    () => (kategori ? PRODUCTS.filter((p) => p.kategori === kategori) : PRODUCTS),
    [kategori],
  );
  const unggulan = useMemo(() => [...PRODUCTS].sort((a, b) => b.terjual - a.terjual).slice(0, 8), []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto space-y-12 px-4 pt-6 pb-16 md:pt-8">
        <MarketplaceHero />

        {/* KATEGORI */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Kategori</h2>
              <p className="text-sm text-muted-foreground">Temukan produk sesuai kebutuhanmu</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 md:grid-cols-8">
            {CATEGORIES.map((c) => (
              <CategoryPill key={c.slug} category={c} active={kategori === c.slug} />
            ))}
          </div>
        </section>

        {/* PRODUK UNGGULAN — slider */}
        <section id="produk-unggulan">
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Produk Unggulan</h2>
              <p className="text-sm text-muted-foreground">Pilihan terlaris minggu ini</p>
            </div>
          </div>
          <ProductCarousel products={unggulan} />
        </section>

        {/* TOKO PILIHAN */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Toko Anggota Pilihan</h2>
              <p className="text-sm text-muted-foreground">Toko-toko terverifikasi dari komunitas T-COOL</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STORES.map((s) => (
              <StoreCard key={s.slug} store={s} />
            ))}
          </div>
        </section>

        {/* SEMUA PRODUK / FILTER KATEGORI */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                {cat ? `Kategori: ${cat.label}` : "Semua Produk"}
              </h2>
              <p className="text-sm text-muted-foreground">{filtered.length} produk tersedia</p>
            </div>
            {cat && (
              <Link to="/marketplace">
                <Button size="sm" variant="outline" className="rounded-full">
                  Reset filter
                </Button>
              </Link>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Belum ada produk di kategori ini.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* CTA Gabung Anggota */}
        <section
          className="relative overflow-hidden rounded-3xl border border-border p-8 md:p-12"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="relative grid items-center gap-6 md:grid-cols-2">
            <div className="text-primary-foreground">
              <h2 className="text-2xl font-bold leading-tight md:text-3xl">
                Punya usaha? Gabung jadi anggota & buka toko gratis.
              </h2>
              <p className="mt-3 max-w-md text-sm opacity-90 md:text-base">
                Jangkau ratusan anggota koperasi sebagai pelanggan setiamu.
                Tanpa biaya listing, tanpa potongan tersembunyi.
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
