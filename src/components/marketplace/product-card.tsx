import { Link } from "@tanstack/react-router";
import { Star, MapPin } from "lucide-react";
import { fmtIDR, getStore, type MarketplaceProduct } from "@/lib/marketplace-mock";

export function ProductCard({ product }: { product: MarketplaceProduct }) {
  const toko = getStore(product.toko_slug);
  const diskon = product.harga_coret
    ? Math.round(((product.harga_coret - product.harga) / product.harga_coret) * 100)
    : 0;

  return (
    <Link
      to="/marketplace/produk/$id"
      params={{ id: product.id }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.gambar}
          alt={product.nama}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {diskon > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-md">
            -{diskon}%
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{product.nama}</h3>
        <div className="flex items-baseline gap-1.5">
          <p className="text-base font-bold text-primary">{fmtIDR(product.harga)}</p>
          {product.harga_coret && (
            <p className="text-[11px] text-muted-foreground line-through">{fmtIDR(product.harga_coret)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 fill-warning text-warning" />
          <span className="font-medium text-foreground">{product.rating}</span>
          <span>· {product.terjual} terjual</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{toko?.nama ?? product.lokasi}</span>
        </div>
      </div>
    </Link>
  );
}
