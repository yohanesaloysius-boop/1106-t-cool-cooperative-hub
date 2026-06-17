import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, MessageCircle, Store as StoreIcon } from "lucide-react";
import { cartItemEffectivePrice } from "@/lib/cart";
import { fmtIDR, getStoreBySlug, listStoreProducts, type DbProduct } from "@/lib/marketplace-api";

export const Route = createFileRoute("/marketplace/toko/$slug")({
  head: () => ({
    meta: [
      { title: "Toko — Marketplace T-COOL" },
      { name: "description", content: "Detail toko anggota koperasi T-COOL." },
    ],
  }),
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
  const { slug } = Route.useParams();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["mp-store", slug],
    queryFn: () => getStoreBySlug(slug),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["mp-store-products", store?.id],
    queryFn: () => (store ? listStoreProducts(store.id) : Promise.resolve([])),
    enabled: !!store,
  });
  const products = allProducts.filter((p) => p.status_produk === "active");

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Memuat toko…</div>
      </div>
    );
  }
  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold">Toko tidak ditemukan.</p>
          <Link to="/marketplace">
            <Button className="mt-4 rounded-full">Kembali ke Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const waLink = store.whatsapp
    ? `https://wa.me/${String(store.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
        `Halo, saya tertarik dengan produk di toko *${store.nama_toko}* (Marketplace T-COOL).`,
      )}`
    : null;

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
            {store.banner ? (
              <img src={store.banner} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: "var(--gradient-primary)" }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          <div className="-mt-12 flex flex-col gap-4 p-5 md:flex-row md:items-end md:p-6">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-card shadow-md">
              {store.logo ? (
                <img src={store.logo} alt={store.nama_toko} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <StoreIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{store.nama_toko}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><StoreIcon className="h-3.5 w-3.5" /> {products.length} produk</span>
                {store.alamat && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {store.alamat}</span>}
              </div>
            </div>
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer">
                <Button className="rounded-full">
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat Toko
                </Button>
              </a>
            )}
          </div>
          {store.deskripsi && (
            <div className="border-t border-border px-5 py-4 md:px-6">
              <p className="text-sm text-foreground/80">{store.deskripsi}</p>
            </div>
          )}
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
              {products.map((p) => (
                <StoreProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function StoreProductCard({ product }: { product: DbProduct }) {
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
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-md">-{diskon}%</span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{product.nama_produk}</h3>
        <div className="flex items-baseline gap-1.5">
          <p className="text-base font-bold text-primary">{fmtIDR(eff)}</p>
          {diskon > 0 && <p className="text-[11px] text-muted-foreground line-through">{fmtIDR(Number(product.harga))}</p>}
        </div>
        <p className="text-[11px] text-muted-foreground">Stok {product.stok}</p>
      </div>
    </Link>
  );
}
