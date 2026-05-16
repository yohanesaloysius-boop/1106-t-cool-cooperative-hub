import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarCheck, MapPin, MessageCircle, Star, Store as StoreIcon } from "lucide-react";
import { ProductCard } from "@/components/marketplace/product-card";
import { getStore, getStoreProducts, type MarketplaceProduct } from "@/lib/marketplace-mock";

export const Route = createFileRoute("/marketplace/toko/$slug")({
  head: ({ params }) => {
    const s = getStore(params.slug);
    return {
      meta: [
        { title: s ? `${s.nama} — Toko Marketplace T-COOL` : "Toko — Marketplace T-COOL" },
        { name: "description", content: s?.deskripsi ?? "Detail toko anggota koperasi T-COOL." },
        ...(s?.cover ? [{ property: "og:image" as const, content: s.cover }] : []),
      ],
    };
  },
  loader: ({ params }) => {
    const store = getStore(params.slug);
    if (!store) throw notFound();
    const products = getStoreProducts(params.slug);
    return { store, products };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold">Toko tidak ditemukan.</p>
        <Link to="/marketplace">
          <Button className="mt-4 rounded-full">Kembali ke Marketplace</Button>
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-destructive">{error.message}</p>
      </div>
    </div>
  ),
  component: StoreDetail,
});

function StoreDetail() {
  const { store, products } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 pt-6 pb-16">
        <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Marketplace
        </Link>

        {/* Cover + Profile */}
        <div
          className="mt-4 overflow-hidden rounded-3xl border border-border bg-card"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="relative h-40 md:h-56">
            <img src={store.cover} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          <div className="-mt-12 flex flex-col gap-4 p-5 md:flex-row md:items-end md:p-6">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-md">
              <img src={store.logo} alt={store.nama} className="h-full w-full object-cover" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{store.nama}</h1>
              <p className="text-sm text-muted-foreground">oleh {store.pemilik}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  <span className="font-semibold text-foreground">{store.rating}</span>
                </span>
                <span className="inline-flex items-center gap-1"><StoreIcon className="h-3.5 w-3.5" /> {store.produk_count} produk</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {store.kota}</span>
                <span className="inline-flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5" /> Bergabung {new Date(store.bergabung).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
              </div>
            </div>
            <Button className="rounded-full">
              <MessageCircle className="mr-2 h-4 w-4" /> Chat Toko
            </Button>
          </div>
          <div className="border-t border-border px-5 py-4 md:px-6">
            <p className="text-sm text-foreground/80">{store.deskripsi}</p>
          </div>
        </div>

        {/* Produk */}
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Produk dari Toko Ini</h2>
          {products.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Belum ada produk yang ditampilkan.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {(products as MarketplaceProduct[]).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
