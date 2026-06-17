import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store as StoreIcon,
  Eye,
} from "lucide-react";
import {
  addFavorite,
  fmtIDR,
  getProductById,
  incrementProductView,
  listMyFavorites,
  listProductReviews,
  removeFavorite,
  upsertReview,
} from "@/lib/marketplace-api";
import { useCart, cartItemEffectivePrice } from "@/lib/cart";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketplace/produk/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const cart = useCart();
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["mp-product", id],
    queryFn: () => getProductById(id),
  });

  const { data: reviews = [], refetch: refetchReviews } = useQuery({
    queryKey: ["mp-reviews", id],
    queryFn: () => listProductReviews(id),
  });

  const { data: favs = [], refetch: refetchFavs } = useQuery({
    queryKey: ["mp-fav", user?.id],
    queryFn: () => (user ? listMyFavorites(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  useEffect(() => {
    if (id) void incrementProductView(id);
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Memuat produk…</div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold">Produk tidak ditemukan.</p>
          <Link to="/marketplace">
            <Button className="mt-4 rounded-full">Kembali ke Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const p: any = product;
  const store = p.marketplace_stores;
  const cat = p.marketplace_categories;
  const images: string[] =
    Array.isArray(p.gambar_produk) && p.gambar_produk.length
      ? p.gambar_produk
      : ["https://placehold.co/800x800?text=Produk"];
  const diskon = p.diskon_persen ?? 0;
  const hargaEfektif = cartItemEffectivePrice({ harga: Number(p.harga), diskon_persen: diskon });
  const isFav = favs.some((f: any) => f.product_id === id);
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0;

  // Hanya anggota yang sudah login (dan berstatus aktif) yang boleh transaksi.
  const ensureCanTransact = () => {
    if (!user) {
      toast.error("Login dulu untuk berbelanja. Hanya anggota koperasi yang dapat bertransaksi.");
      navigate({ to: "/auth" });
      return false;
    }
    if (profile?.status !== "active") {
      toast.error("Hanya anggota aktif koperasi yang dapat berbelanja.");
      return false;
    }
    return true;
  };

  const handleAdd = () => {
    if (!ensureCanTransact()) return;
    cart.add(
      {
        product_id: p.id,
        store_id: p.store_id,
        store_slug: store?.slug,
        store_nama: store?.nama_toko ?? "Toko",
        store_whatsapp: store?.whatsapp,
        nama_produk: p.nama_produk,
        harga: Number(p.harga),
        diskon_persen: diskon,
        gambar: images[0],
        stok: p.stok ?? 0,
      },
      qty,
    );
    toast.success("Ditambahkan ke keranjang");
  };

  const handleBuyNow = () => {
    if (!ensureCanTransact()) return;
    handleAdd();
    navigate({ to: "/marketplace/checkout" });
  };

  const handleFav = async () => {
    if (!user) {
      toast.error("Login dulu untuk menyimpan favorit");
      navigate({ to: "/auth" });
      return;
    }
    try {
      if (isFav) await removeFavorite(user.id, id);
      else await addFavorite(user.id, id);
      refetchFavs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const waLink = store?.whatsapp
    ? `https://wa.me/${String(store.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
        `Halo, saya tertarik dengan produk *${p.nama_produk}* di marketplace T-COOL.`,
      )}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 pt-6 pb-16">
        <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Marketplace
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          {/* Gallery */}
          <div className="lg:col-span-5 space-y-3">
            <div className="overflow-hidden rounded-3xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="aspect-square">
                <img src={images[imgIdx]} alt={p.nama_produk} className="h-full w-full object-cover" />
              </div>
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-xl border-2 transition",
                      i === imgIdx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-3xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex flex-wrap items-center gap-2">
                {cat && <Badge variant="secondary" className="rounded-full">{cat.nama_kategori}</Badge>}
                {p.is_featured && <Badge className="rounded-full bg-warning text-warning-foreground">⭐ Unggulan</Badge>}
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{p.nama_produk}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="font-semibold text-foreground">{avgRating ? avgRating.toFixed(1) : "—"}</span>
                  <span>({reviews.length} ulasan)</span>
                </span>
                <span>· Stok {p.stok}</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {p.view_count ?? 0} dilihat
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <p className="text-3xl font-bold text-primary md:text-4xl">{fmtIDR(hargaEfektif)}</p>
                {diskon > 0 && (
                  <>
                    <p className="text-base text-muted-foreground line-through">{fmtIDR(Number(p.harga))}</p>
                    <Badge className="rounded-full bg-destructive text-destructive-foreground">-{diskon}%</Badge>
                  </>
                )}
              </div>

              {/* qty */}
              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm font-medium">Jumlah</span>
                <div className="inline-flex items-center rounded-full border border-border">
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={() => setQty(Math.max(1, qty - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={() => setQty(Math.min(p.stok || 1, qty + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="lg" className="rounded-full shadow-md" onClick={handleBuyNow} disabled={!p.stok}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Beli Sekarang
                </Button>
                <Button size="lg" variant="outline" className="rounded-full" onClick={handleAdd} disabled={!p.stok}>
                  + Keranjang
                </Button>
                <Button size="lg" variant="ghost" className="rounded-full" onClick={handleFav}>
                  <Heart className={cn("mr-2 h-4 w-4", isFav && "fill-destructive text-destructive")} />
                  {isFav ? "Tersimpan" : "Favorit"}
                </Button>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noreferrer">
                    <Button size="lg" variant="outline" className="rounded-full">
                      <MessageCircle className="mr-2 h-4 w-4" /> Chat
                    </Button>
                  </a>
                )}
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Toko terverifikasi koperasi T-COOL
              </p>
            </div>

            {store && (
              <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-border bg-muted">
                  {store.logo && <img src={store.logo} alt={store.nama_toko} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{store.nama_toko}</p>
                  {store.alamat && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {store.alamat}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="rounded-full" disabled>
                  <StoreIcon className="mr-1.5 h-3.5 w-3.5" /> Toko
                </Button>
              </div>
            )}

            <div className="rounded-3xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h2 className="text-base font-semibold">Deskripsi Produk</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                {p.deskripsi || "Penjual belum menambahkan deskripsi."}
              </p>
            </div>

            {/* Reviews */}
            <ReviewsSection
              productId={id}
              reviews={reviews}
              userId={user?.id}
              onSaved={() => refetchReviews()}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ReviewsSection({
  productId,
  reviews,
  userId,
  onSaved,
}: {
  productId: string;
  reviews: any[];
  userId?: string;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [komentar, setKomentar] = useState("");
  const [saving, setSaving] = useState(false);
  const my = reviews.find((r) => r.member_id === userId);

  useEffect(() => {
    if (my) {
      setRating(my.rating);
      setKomentar(my.komentar ?? "");
    }
  }, [my]);

  const submit = async () => {
    if (!userId) {
      toast.error("Login dulu untuk memberi ulasan");
      return;
    }
    setSaving(true);
    try {
      await upsertReview({ product_id: productId, member_id: userId, rating, komentar });
      toast.success("Ulasan disimpan");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <h2 className="text-base font-semibold">Ulasan Pembeli ({reviews.length})</h2>

      {userId && (
        <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-border p-4">
          <p className="text-sm font-medium">{my ? "Edit ulasan Anda" : "Tulis ulasan"}</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} type="button">
                <Star className={cn("h-6 w-6", n <= rating ? "fill-warning text-warning" : "text-muted-foreground")} />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Bagaimana pengalaman Anda dengan produk ini?"
            value={komentar}
            onChange={(e) => setKomentar(e.target.value)}
            rows={3}
          />
          <Button onClick={submit} disabled={saving} className="rounded-full">
            {saving ? "Menyimpan…" : my ? "Perbarui" : "Kirim ulasan"}
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">Belum ada ulasan untuk produk ini.</p>}
        {reviews.map((r: any) => (
          <div key={r.id} className="border-b border-border pb-3 last:border-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                {r.profiles?.foto_url && <img src={r.profiles.foto_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div>
                <p className="text-sm font-medium">{r.profiles?.nama_lengkap ?? "Anggota"}</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("h-3 w-3", n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground")} />
                  ))}
                </div>
              </div>
            </div>
            {r.komentar && <p className="mt-2 text-sm text-foreground/80">{r.komentar}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
