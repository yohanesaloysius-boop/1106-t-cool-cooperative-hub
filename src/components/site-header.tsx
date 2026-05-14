import { Link } from "@tanstack/react-router";
import { Sprout, Phone, Mail, MapPin } from "lucide-react";

const links = [
  { to: "/", label: "Beranda" },
  { to: "/daftar-anggota", label: "Daftar Anggota" },
  { to: "/tentang", label: "Tentang" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-4 z-40 px-3 md:px-6">
      <div
        className="container mx-auto flex h-16 items-center justify-between rounded-full border border-white/60 bg-white/65 px-3 pl-4 pr-2 backdrop-blur-xl supports-[backdrop-filter]:bg-white/55 md:h-[68px] md:px-6"
        style={{ boxShadow: "0 6px 28px -16px oklch(0.22 0.05 180 / 0.18)" }}
      >
        <Link to="/" className="group flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-white/60 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-6"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sprout className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-bold tracking-tight md:text-base">
            T-Cool <span className="text-primary">Koperasi</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-foreground bg-primary/10" }}
              inactiveProps={{ className: "text-foreground/70 hover:text-foreground" }}
              className="group relative rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="md:hidden" />

      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10 mt-20">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} T-COOL Koperasi. Sistem koperasi digital.</p>
        <p>Dibangun untuk koperasi Indonesia.</p>
      </div>
    </footer>
  );
}