import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Wallet, HandCoins, Calculator, Receipt, PiggyBank, LogOut, Loader2, ShieldCheck, Users, User as UserIcon, FolderOpen, History, FileBarChart2, Coins, FileSignature, CalendarDays, Activity, Settings as SettingsIcon, ShoppingBag, Store as StoreIcon, Heart, ClipboardList, Home, Landmark, UsersRound, Shield, BookOpen, BookText, Archive, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  ketua: "Ketua",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  anggota: "Anggota",
};
function roleLabel(roles: AppRole[], viewAsMember: boolean): string {
  if (viewAsMember) return "Anggota";
  const order: AppRole[] = ["super_admin", "ketua", "bendahara", "sekretaris", "anggota"];
  const r = order.find((x) => roles.includes(x)) ?? "anggota";
  return ROLE_LABEL[r];
}

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavGroup = { id: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    id: "dasbor",
    label: "Dasbor Utama",
    icon: Home,
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/profil", label: "Profil", icon: UserIcon },
      { to: "/riwayat", label: "Riwayat", icon: History },
      { to: "/favorit", label: "Favorit", icon: Heart },
      { to: "/lowongan", label: "Lowongan Kerja", icon: Briefcase },
      { to: "/admin/lowongan", label: "Kelola Lowongan", icon: Briefcase, adminOnly: true },
    ],
  },
  {
    id: "keuangan",
    label: "Koperasi Keuangan",
    icon: Landmark,
    items: [
      // Admin Koperasi - Inti
      { to: "/admin", label: "Dasbor Admin", icon: ShieldCheck, adminOnly: true },
      { to: "/admin/anggota", label: "Kelola Anggota", icon: Users, adminOnly: true },
      { to: "/admin/pengaturan", label: "Pengaturan Koperasi", icon: SettingsIcon, adminOnly: true },
      { to: "/admin/audit", label: "Audit Log", icon: Activity, adminOnly: true },
      // Anggota
      { to: "/simpanan", label: "Simpanan", icon: PiggyBank },
      { to: "/pinjaman", label: "Pinjaman", icon: HandCoins },
      { to: "/penjamin", label: "Penjamin Saya", icon: Shield },
      { to: "/angsuran", label: "Angsuran", icon: Receipt },
      { to: "/shu", label: "SHU & Reward", icon: Wallet },
      { to: "/buku-besar", label: "Buku Besar", icon: BookOpen },
      { to: "/kalkulator", label: "Kalkulator", icon: Calculator },
      { to: "/approval", label: "Status Approval", icon: FileSignature },
      // Admin Koperasi - Keuangan
      { to: "/admin/buku-besar", label: "Buku Besar Anggota", icon: BookOpen, adminOnly: true },
      { to: "/admin/buku-kas", label: "Buku Kas Harian", icon: BookText, adminOnly: true },
      { to: "/admin/arsip-transaksi", label: "Arsip Digital Transaksi", icon: Archive, adminOnly: true },
      { to: "/admin/laporan", label: "Laporan Keuangan", icon: FileBarChart2, adminOnly: true },
      { to: "/admin/laporan-rat", label: "Laporan RAT", icon: FileBarChart2, adminOnly: true },
      { to: "/admin/rekonsiliasi", label: "Rekonsiliasi Bank", icon: Landmark, adminOnly: true },
      { to: "/admin/penjamin", label: "Monitoring Penjamin", icon: Shield, adminOnly: true },
      { to: "/admin/shu", label: "Distribusi SHU", icon: Coins, adminOnly: true },
      { to: "/admin/approval", label: "Approval Digital", icon: FileSignature, adminOnly: true },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace Komunitas",
    icon: ShoppingBag,
    items: [
      // Anggota / Pembeli
      { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { to: "/marketplace-saya", label: "Marketplace Saya", icon: StoreIcon },
      { to: "/dashboard-belanja", label: "Dashboard Belanja", icon: ClipboardList },
      { to: "/transaksi-saya", label: "Transaksi Saya", icon: Receipt },
      { to: "/saldo", label: "Saldo & Pencairan", icon: Wallet },
      // Admin Marketplace
      { to: "/admin/marketplace", label: "Manajemen Marketplace", icon: StoreIcon, adminOnly: true },
      { to: "/admin/seller-verify", label: "Verifikasi Seller", icon: ShieldCheck, adminOnly: true },
      { to: "/admin/escrow", label: "Escrow & Pencairan", icon: Wallet, adminOnly: true },
      { to: "/admin/fee", label: "Fee Marketplace", icon: Coins, adminOnly: true },
      { to: "/admin/komplain", label: "Komplain & Refund", icon: FileSignature, adminOnly: true },
      { to: "/admin/statistik", label: "Statistik & Top Produk", icon: FileBarChart2, adminOnly: true },
    ],
  },
  {
    id: "komunitas",
    label: "Komunitas & Kegiatan",
    icon: UsersRound,
    items: [
      { to: "/dokumen", label: "Dokumen", icon: FolderOpen },
      { to: "/rapat", label: "Rapat", icon: CalendarDays },
    ],
  },
];

function AuthLayout() {
  const { user, profile, loading, signOut, roles, isPengurus, viewAsMember, setViewAsMember } = useAuth();
  const realPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const visibleGroups = navGroups
    .filter((g) => !g.adminOnly || isPengurus)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || isPengurus) }));
  const mobileNav = visibleGroups.flatMap((g) => g.items).slice(0, 5);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const initials = (profile?.nama_lengkap ?? user.email ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
        <Link to="/dashboard" className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
          <span className="font-bold tracking-tight">T-COOL <span className="text-primary">Koperasi</span></span>
        </Link>
        <nav className="flex-1 overflow-y-auto p-3">
          <Accordion
            type="single"
            collapsible
            defaultValue={visibleGroups.find((g) => g.items.some((i) => pathname === i.to))?.id ?? visibleGroups[0]?.id}
            className="space-y-1"
          >
            {visibleGroups.map((group) => {
              const groupActive = group.items.some((i) => pathname === i.to);
              return (
                <AccordionItem key={group.id} value={group.id} className="border-none">
                  <AccordionTrigger
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold no-underline hover:no-underline transition-colors",
                      groupActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="flex flex-1 items-center gap-3">
                      <group.icon className="h-4 w-4" />
                      {group.label}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1 pt-1">
                    <div className="ml-3 space-y-0.5 border-l border-border/60 pl-2">
                      {group.items.map((n) => {
                        const active = pathname === n.to;
                        return (
                          <Link
                            key={n.to}
                            to={n.to}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                              active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-foreground/70 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <n.icon className="h-3.5 w-3.5" />
                            {n.label}
                          </Link>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.nama_lengkap ?? "Anggota"}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.nomor_anggota ?? "—"}</p>
              <Badge variant="secondary" className="mt-1 rounded-full px-2 py-0 text-[10px] font-semibold">
                {roleLabel(roles, viewAsMember)}
              </Badge>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
            <span className="font-bold">T-COOL</span>
          </div>
          <div className="hidden lg:block">
            <p className="font-semibold">{profile?.nama_lengkap ?? "Anggota"}</p>
          </div>
          <div className="flex items-center gap-2">
            {realPengurus && (
              <div
                role="tablist"
                aria-label="Mode tampilan"
                className="inline-flex items-center rounded-full border border-border bg-muted/60 p-0.5 text-xs font-semibold shadow-inner"
              >
                <button
                  role="tab"
                  aria-selected={!viewAsMember}
                  title="Mode Admin / Pengurus"
                  onClick={() => {
                    if (!viewAsMember) return;
                    setViewAsMember(false);
                    toast.success("Mode Pengurus aktif", { description: "Akses pengurus dipulihkan." });
                  }}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all",
                    !viewAsMember
                      ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-300"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                  {!viewAsMember && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </button>
                <button
                  role="tab"
                  aria-selected={viewAsMember}
                  title="Mode Anggota"
                  onClick={() => {
                    if (viewAsMember) return;
                    setViewAsMember(true);
                    toast.success("Mode Anggota aktif", { description: "Anda melihat tampilan seperti anggota biasa." });
                    if (pathname.startsWith("/admin")) navigate({ to: "/dashboard" });
                  }}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all",
                    viewAsMember
                      ? "bg-rose-500 text-white shadow-sm ring-2 ring-rose-300"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Anggota</span>
                  {viewAsMember && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              </div>
            )}
            <NotificationCenter />
            <Button variant="outline" size="sm" className="gap-2 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>

        <main className="p-4 md:p-8 pb-24 lg:pb-8">
          {profile && profile.status !== "active" && (
            <div className={cn(
              "mb-4 rounded-xl border p-3 text-sm",
              profile.status === "pending" && "border-warning/40 bg-warning/10 text-foreground",
              profile.status === "suspended" && "border-muted bg-muted text-muted-foreground",
              profile.status === "rejected" && "border-destructive/40 bg-destructive/10 text-foreground",
            )}>
              {profile.status === "pending" && "Akun Anda menunggu verifikasi pengurus. Sebagian fitur dibatasi sampai akun diaktifkan."}
              {profile.status === "suspended" && "Akun Anda saat ini ditangguhkan. Hubungi pengurus untuk informasi lebih lanjut."}
              {profile.status === "rejected" && "Pendaftaran Anda ditolak. Silakan hubungi pengurus koperasi."}
            </div>
          )}
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card lg:hidden">
          <div className="grid grid-cols-5">
            {mobileNav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                  <n.icon className="h-5 w-5" />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      
    </div>
  );
}