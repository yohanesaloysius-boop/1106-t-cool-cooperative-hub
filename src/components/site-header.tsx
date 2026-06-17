import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sprout, Phone, Mail, MapPin, LogIn, LayoutDashboard, Shield, User as UserIcon, Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useKoperasiLogo } from "@/hooks/use-koperasi-logo";


const links = [
  { to: "/", label: "Beranda" },
  { to: "/berita", label: "Berita & Kegiatan" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/daftar-anggota", label: "Daftar Anggota" },
  { to: "/tentang", label: "Tentang Kami" },
] as const;

const tentangItems = [
  { hash: "makna-logo", label: "Makna Logo dan Nama" },
  { hash: "visi-misi", label: "Visi dan Misi" },
  { hash: "struktur-organisasi", label: "Alur Tata kelola Koperasi" },
  { hash: "struktur-manajemen", label: "Struktur Manajemen" },
] as const;

export function SiteHeader() {
  const { user, roles, viewAsMember, setViewAsMember } = useAuth();
  const logo = useKoperasiLogo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const realPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));

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
            {logo.url ? <img src={logo.url} alt="Logo koperasi" className={cn("h-full w-full rounded-full", logo.fit === "cover" ? "object-cover" : "object-contain")} /> : <Sprout className="h-5 w-5" />}
          </span>
          <span className="text-[15px] font-bold tracking-tight md:text-base">
            T-Cool <span className="text-primary">Koperasi</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) =>
            l.to === "/tentang" ? (
              <DropdownMenu key={l.to}>
                <DropdownMenuTrigger asChild>
                  <button className="group flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground focus:outline-none">
                    {l.label}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {tentangItems.map((it) => (
                    <DropdownMenuItem key={it.hash} asChild>
                      <Link to="/tentang" hash={it.hash} className="cursor-pointer">
                        {it.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
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
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && realPengurus && (
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-border/70 bg-white/80 p-1 shadow-sm" role="group" aria-label="Mode tampilan">
              <button
                type="button"
                onClick={() => setViewAsMember(false)}
                aria-pressed={!viewAsMember}
                title="Mode Admin / Pengurus"
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  !viewAsMember
                    ? "bg-emerald-500 text-white shadow"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
                {!viewAsMember && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-white ring-2 ring-emerald-300 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setViewAsMember(true)}
                aria-pressed={viewAsMember}
                title="Mode Anggota"
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  viewAsMember
                    ? "bg-emerald-500 text-white shadow"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                <UserIcon className="h-3.5 w-3.5" />
                Anggota
                {viewAsMember && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-white ring-2 ring-emerald-300 animate-pulse" />
                )}
              </button>
            </div>
          )}

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

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden rounded-full" aria-label="Buka menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {links.map((l) =>
                  l.to === "/tentang" ? (
                    <div key={l.to} className="flex flex-col">
                      <Link
                        to={l.to}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-primary/10"
                      >
                        {l.label}
                      </Link>
                      <div className="ml-3 flex flex-col border-l border-border pl-2">
                        {tentangItems.map((it) => (
                          <Link
                            key={it.hash}
                            to="/tentang"
                            hash={it.hash}
                            onClick={() => setMobileOpen(false)}
                            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                          >
                            {it.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-primary/10"
                  >
                    {l.label}
                  </Link>
                  ),
                )}
                {user && realPengurus && (
                  <div className="mt-4 border-t pt-4">
                    <p className="px-3 text-xs text-muted-foreground mb-2">Mode Tampilan</p>
                    <button
                      type="button"
                      onClick={() => { setViewAsMember(false); setMobileOpen(false); }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm", !viewAsMember ? "bg-primary/10 text-primary font-medium" : "")}
                    >
                      <Shield className="h-4 w-4" /> Mode Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => { setViewAsMember(true); setMobileOpen(false); }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm", viewAsMember ? "bg-primary/10 text-primary font-medium" : "")}
                    >
                      <UserIcon className="h-4 w-4" /> Mode Anggota
                    </button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}


export function SiteFooter() {
  const logo = useKoperasiLogo();
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
                {logo ? <img src={logo} alt="Logo koperasi" className="h-full w-full rounded-full object-cover" /> : <Sprout className="h-4 w-4" />}
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