import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, MessageCircle, ShieldCheck, ShoppingCart, Star, Store as StoreIcon } from "lucide-react";
import { ProductCard } from "@/components/marketplace/product-card";
import { fmtIDR, getProduct, getStore, getStoreProducts, PRODUCTS } from "@/lib/marketplace-mock";

export const Route = createFileRoute("/marketplace/produk/$id")({
  head: ({ params }) => {
    const p = getProduct(params.id);
    return {
      meta: [
        { title: p ? `${p.nama} — Marketplace T-COOL` : "Produk — Marketplace T-COOL" },
        { name: "description", content: p?.deskripsi ?? "Detail produk marketplace komunitas T-COOL." },
        ...(p?.gambar ? [{ property: "og:image" as const, content: p.gambar }] : []),
      ],
    };
  },
  loader: ({ params }) => {
    const product = getProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold">Produk tidak ditemukan.</p>
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
  component: ProductDetail,
});

function ProductDetail() {
  const { product } = Route.useLoaderData();
  const toko = getStore(product.toko_slug);
  const related = PRODUCTS.filter((p) => p.kategori === product.kategori && p.id !== product.id).slice(0, 4);
  const diskon = product.harga_coret
    ? Math.round(((product.harga_coret - product.harga) / product.harga_coret) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 pt-6 pb-16">
        <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Marketplace
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          {/* Galeri */}
          <div className="lg:col-span-5">
            <div
              className="overflow-hidden rounded-3xl border border-border bg-card"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="aspect-square">
                <img src={product.gambar} alt={product.nama} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="lg:col-span-7 space-y-5">
            <div
              className="rounded-3xl border border-border bg-card p-6"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Badge variant="secondary" className="rounded-full">{product.kategori}</Badge>
              <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{product.nama}</h1>

              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="font-semibold text-foreground">{product.rating}</span>
                </span>
                <span>· {product.terjual} terjual</span>
                <span>· Stok {product.stok}</span>
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <p className="text-3xl font-bold text-primary md:text-4xl">{fmtIDR(product.harga)}</p>
                {product.harga_coret && (
                  <>
                    <p className="text-base text-muted-foreground line-through">{fmtIDR(product.harga_coret)}</p>
                    <Badge className="rounded-full bg-destructive text-destructive-foreground">-{diskon}%</Badge>
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="lg" className="rounded-full shadow-md">
                  <ShoppingCart className="mr-2 h-4 w-4" /> Beli Sekarang
                </Button>
                <Button size="lg" variant="outline" className="rounded-full">
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat Penjual
                </Button>
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Toko terverifikasi koperasi T-COOL
              </p>
            </div>

            {/* Toko */}
            {toko && (
              <Link
                to="/marketplace/toko/$slug"
                params={{ slug: toko.slug }}
                className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-border">
                  <img src={toko.logo} alt={toko.nama} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toko.nama}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {toko.kota} · {toko.produk_count} produk
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">
                  <StoreIcon className="mr-1.5 h-3.5 w-3.5" /> Kunjungi
                </Button>
              </Link>
            )}

            {/* Deskripsi */}
            <div
              className="rounded-3xl border border-border bg-card p-6"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="text-base font-semibold">Deskripsi Produk</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{product.deskripsi}</p>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold tracking-tight">Produk Serupa</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
