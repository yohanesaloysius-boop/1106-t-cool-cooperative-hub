import { Link } from "@tanstack/react-router";
import { Sprout, Phone, Mail, MapPin, LogIn, LayoutDashboard, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Beranda" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/daftar-anggota", label: "Daftar Anggota" },
  { to: "/tentang", label: "Tentang" },
] as const;

export function SiteHeader() {
  const { user } = useAuth();
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

        {user ? (
          <Link to="/dashboard">
            <Button size="sm" className="rounded-full shadow-sm">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </Link>
        ) : (
          <Link to="/auth">
            <Button size="sm" className="rounded-full shadow-sm">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-12 mt-20">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-white/60"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Sprout className="h-4 w-4" />
              </span>
              <span className="text-base font-bold tracking-tight">
                T-Cool <span className="text-primary">Koperasi</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Sistem koperasi digital — modern, transparan, dan terpercaya.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Hubungi Kami</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="https://wa.me/6281959171997"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>0819 5917 1997 <span className="text-xs opacity-70">(WhatsApp)</span></span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:t-coolkoperasi@gmail.com"
                  className="group flex items-start gap-2.5 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="break-all">t-coolkoperasi@gmail.com</span>
                </a>
              </li>
              <li className="flex items-start gap-2.5 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Center Park Blok 3 No. 3, Simpang Kara, Batam</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Navigasi</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted-foreground hover:text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} T-COOL Koperasi. Sistem koperasi digital.</p>
          <p>Dibangun untuk koperasi Indonesia.</p>
        </div>
      </div>
    </footer>
  );
}