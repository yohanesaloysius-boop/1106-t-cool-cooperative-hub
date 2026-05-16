import { Link } from "@tanstack/react-router";
import { Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketplaceHero() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border p-6 md:p-10"
      style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
    >
      <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-primary-glow/30 blur-3xl" />

      <div className="relative grid items-center gap-8 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Marketplace Komunitas T-COOL
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
            Belanja dari <span className="text-primary">Anggota</span>,<br />
            untuk Anggota.
          </h1>
          <p className="mt-4 max-w-md text-sm text-foreground/70 md:text-base">
            Temukan produk & jasa terbaik dari sesama anggota koperasi.
            Harga komunitas, kualitas terjamin, untung bersama.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-full shadow-lg">
                <Store className="mr-2 h-4 w-4" /> Buka Toko Sekarang
              </Button>
            </Link>
            <a href="#produk-unggulan">
              <Button size="lg" variant="outline" className="rounded-full bg-card/80 backdrop-blur">
                Jelajahi Produk
              </Button>
            </a>
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="grid grid-cols-3 gap-3">
            {[
              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&h=300&fit=crop",
              "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&h=300&fit=crop",
            ].map((src, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-2xl ring-1 ring-white/40"
                style={{
                  transform: `translateY(${i % 2 === 0 ? "0" : "16px"})`,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
