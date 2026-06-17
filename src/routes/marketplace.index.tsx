import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { MarketplaceHero } from "@/components/marketplace/marketplace-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, ShoppingCart, UserPlus, X } from "lucide-react";
import {
  fmtIDR,
  listCategories,
  listProductsPage,
  listStores,
  type DbCategory,
  type DbProduct,
  type DbStore,
} from "@/lib/marketplace-api";
import { cartItemEffectivePrice, useCart } from "@/lib/cart";

type Search = { kategori?: string; q?: string };

export const Route = createFileRoute("/marketplace/")({
  head: () => ({
    meta: [
      { title: "Marketplace Komunitas — T-COOL Koperasi" },
      { name: "description", content: "Belanja produk & jasa langsung dari anggota koperasi T-COOL. Harga komunitas, kualitas terjamin." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    kategori: typeof search.kategori === "string" ? search.kategori : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: MarketplacePage,
});

const PAGE_SIZE = 12;

function MarketplacePage() {
  const { kategori, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/marketplace/" });
  const cart = useCart();

  // Produk hanya ditampilkan setelah pengunjung klik "Jelajahi Produk",
  // atau saat mereka memilih kategori / mencari sesuatu.
  const [explored, setExplored] = useState(false);
  const showProducts = explored || !!kategori || !!q;
  const reveal = () => {
    setExplored(true);
    setTimeout(() => {
      document.getElementById("semua-produk")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Debounced search input
  const [term, setTerm] = useState(q ?? "");
  useEffect(() => setTerm(q ?? ""), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = term.trim() || undefined;
      if (next !== q) navigate({ search: (prev: Search) => ({ ...prev, q: next }) });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const { data: categories = [] } = useQuery({ queryKey: ["mp-cats"], queryFn: listCategories });
  const { data: stores = [] } = useQuery({ queryKey: ["mp-stores"], queryFn: () => listStores("active") });

  const infinite = useInfiniteQuery({
    queryKey: ["mp-list-page", kategori ?? null, q ?? null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listProductsPage({ categorySlug: kategori, search: q, page: pageParam as number, pageSize: PAGE_SIZE }),
    getNextPageParam: (last) => {
      const loaded = (last.page + 1) * last.pageSize;
      return loaded < last.count ? last.page + 1 : undefined;
    },
  });

  const products = useMemo(
    () => (infinite.data?.pages ?? []).flatMap((p) => p.rows),
    [infinite.data],
  );
  const total = infinite.data?.pages[0]?.count ?? 0;

  const featured = useMemo(() => products.filter((p) => p.is_featured).slice(0, 8), [products]);
  const currentCat = categories.find((c) => c.slug === kategori);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && infinite.hasNextPage && !infinite.isFetchingNextPage) {
        infinite.fetchNextPage();
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [infinite.hasNextPage, infinite.isFetchingNextPage, infinite.fetchNextPage]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

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

      <main className="container mx-auto space-y-10 px-4 pt-6 pb-16 md:pt-8">
        <MarketplaceHero onExplore={reveal} />

        {showProducts && (
        <>
        {/* SEARCH BAR */}
        <section className="sticky top-16 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cari produk, contoh: kopi, batik, jasa…"
              className="h-12 rounded-full border-border bg-card pl-11 pr-11 text-sm shadow-sm"
            />
            {term && (
              <button
                onClick={() => setTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        {/* KATEGORI */}
        {categories.length > 0 && (
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Kategori</h2>
              <p className="text-sm text-muted-foreground">Temukan produk sesuai kebutuhanmu</p>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              <Link to="/marketplace" search={(p: Search) => ({ ...p, kategori: undefined })}>
                <Badge variant={!kategori ? "default" : "secondary"} className="cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5">
                  Semua
                </Badge>
              </Link>
              {categories.map((c: DbCategory) => (
                <Link key={c.slug} to="/marketplace" search={(p: Search) => ({ ...p, kategori: c.slug })}>
                  <Badge
                    variant={kategori === c.slug ? "default" : "secondary"}
                    className="cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5"
                  >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.nama_kategori}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FEATURED — only when no filter/search */}
        {featured.length > 0 && !kategori && !q && (
          <section id="produk-unggulan" className="scroll-mt-24">
            <div className="mb-4">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">⭐ Produk Unggulan</h2>
              <p className="text-sm text-muted-foreground">Pilihan terbaik dari toko-toko anggota</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {featured.map((p) => <RealProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* TOKO PILIHAN */}
        {stores.length > 0 && !q && (
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Toko Anggota Pilihan</h2>
              <p className="text-sm text-muted-foreground">Toko-toko aktif dari komunitas T-COOL</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stores.slice(0, 6).map((s: DbStore) => (
                <Link
                  key={s.id}
                  to="/marketplace/toko/$slug"
                  params={{ slug: s.slug }}
                  className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/40"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {s.logo && <img src={s.logo} alt={s.nama_toko} loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.nama_toko}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{s.deskripsi}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* SEMUA PRODUK — data nyata dari database */}
        <section id="semua-produk" className="scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                {currentCat ? currentCat.nama_kategori : q ? `Hasil pencarian "${q}"` : "Semua Produk"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {total > 0 ? `${total} produk tersedia` : "Produk dari toko-toko anggota koperasi"}
              </p>
            </div>
          </div>

          {infinite.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <p className="text-sm font-medium">Belum ada produk yang cocok.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Coba ubah kata kunci atau pilih kategori lain.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {products.map((p) => (
                  <RealProductCard key={p.id} product={p} />
                ))}
              </div>
              <div ref={sentinelRef} className="h-10" />
              {infinite.isFetchingNextPage && (
                <p className="py-4 text-center text-sm text-muted-foreground">Memuat produk lainnya…</p>
              )}
            </>
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
        <img
          src={img}
          alt={product.nama_produk}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
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
        {product.stok === 0 && (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-background/90 px-2 py-0.5 text-center text-[10px] font-semibold">
            Habis
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
        {product.marketplace_stores?.status_toko === "active" && (
          <div className="flex items-center gap-1 pt-0.5 text-[10px] font-semibold text-primary">
            <span aria-hidden>✓</span>
            <span>Anggota Aktif Koperasi</span>
          </div>
        )}
      </div>
    </Link>
  );
}
