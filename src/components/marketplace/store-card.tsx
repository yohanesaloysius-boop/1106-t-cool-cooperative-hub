import { Link } from "@tanstack/react-router";
import { Star, Store as StoreIcon, MapPin } from "lucide-react";
import type { MarketplaceStore } from "@/lib/marketplace-mock";

export function StoreCard({ store }: { store: MarketplaceStore }) {
  return (
    <Link
      to="/marketplace/toko/$slug"
      params={{ slug: store.slug }}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
        <img src={store.logo} alt={store.nama} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{store.nama}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="font-medium text-foreground">{store.rating}</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <StoreIcon className="h-3 w-3" /> {store.produk_count}
          </span>
          <span className="inline-flex items-center gap-0.5 truncate">
            <MapPin className="h-3 w-3" /> {store.kota}
          </span>
        </div>
      </div>
    </Link>
  );
}
