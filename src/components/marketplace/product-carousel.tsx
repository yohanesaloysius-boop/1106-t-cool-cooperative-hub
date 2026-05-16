import type { MarketplaceProduct } from "@/lib/marketplace-mock";
import { ProductCard } from "./product-card";

/**
 * Auto-scrolling horizontal carousel of products.
 * Uses CSS marquee (animate-marquee-x). Pauses on hover.
 */
export function ProductCarousel({ products }: { products: MarketplaceProduct[] }) {
  if (products.length === 0) return null;
  const doubled = [...products, ...products];
  return (
    <div
      className="group relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <div className="flex w-max gap-4 animate-marquee-x">
        {doubled.map((p, i) => (
          <div key={`${p.id}-${i}`} className="w-[180px] shrink-0 sm:w-[220px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
