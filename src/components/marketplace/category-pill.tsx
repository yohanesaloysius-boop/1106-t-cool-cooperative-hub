import { Link } from "@tanstack/react-router";
import type { MarketplaceCategory } from "@/lib/marketplace-mock";

export function CategoryPill({ category, active = false }: { category: MarketplaceCategory; active?: boolean }) {
  return (
    <Link
      to="/marketplace"
      search={{ kategori: category.slug } as never}
      className={`group flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/50 ${
        active ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <span className="text-2xl">{category.emoji}</span>
      <span className="text-xs font-medium leading-tight">{category.label}</span>
    </Link>
  );
}
