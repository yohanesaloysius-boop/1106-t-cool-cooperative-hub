import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Wallet, HandCoins, Calculator, Receipt, PiggyBank, LogOut, Loader2, ShieldCheck, ShieldAlert, Users, User as UserIcon, FolderOpen, History, FileBarChart2, Coins, FileSignature, CalendarDays, Activity, Settings as SettingsIcon, ShoppingBag, Store as StoreIcon, Heart, ClipboardList, Home, Landmark, UsersRound, Shield, BookOpen, BookText, Archive, Briefcase, Package, QrCode, Church, GraduationCap, Menu as MenuIcon, MoreHorizontal, DatabaseBackup, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { CommandPalette } from "@/components/command-palette";
import { canAccessAdminPath } from "@/lib/access";


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

export const navGroups: NavGroup[] = [
  {
    id: "dasbor",
    label: "Dasbor Utama",
    icon: Home,
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/profil", label: "Profil", icon: UserIcon },
      { to: "/saldo", label: "Saldo & Pencairan", icon: Wallet },
      { to: "/riwayat", label: "Riwayat", icon: History },
      { to: "/favorit", label: "Favorit", icon: Heart },
      { to: "/lowongan", label: "Lowongan Kerja", icon: Briefcase },
    ],
  },
  {
    id: "simpan-pinjam",
    label: "Simpan Pinjam",
    icon: Landmark,
    items: [
      { to: "/simpanan", label: "Simpanan", icon: PiggyBank },
      
      { to: "/pinjaman", label: "Pinjaman", icon: HandCoins },
      { to: "/penjamin", label: "Penjamin Saya", icon: Shield },
      { to: "/angsuran", label: "Angsuran", icon: Receipt },
      { to: "/shu", label: "SHU & Reward", icon: Wallet },
      { to: "/buku-besar", label: "Buku Besar", icon: BookOpen },
      { to: "/kalkulator", label: "Kalkulator", icon: Calculator },
      { to: "/approval", label: "Status Approval", icon: FileSignature },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: ShoppingBag,
    items: [
      { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { to: "/marketplace-saya", label: "Marketplace Saya", icon: StoreIcon },
      { to: "/dashboard-belanja", label: "Dashboard Belanja", icon: ClipboardList },
      { to: "/transaksi-saya", label: "Transaksi Saya", icon: Receipt },
    ],
  },
  {
    id: "komunitas",
    label: "Komunitas & Kegiatan",
    icon: UsersRound,
    items: [
      { to: "/dokumen", label: "Dokumen", icon: FolderOpen },
      { to: "/berita", label: "Berita & Kegiatan", icon: Newspaper },
      { to: "/rapat", label: "Rapat", icon: CalendarDays },
      { to: "/voting", label: "Voting RAT", icon: FileSignature },
      { to: "/survei", label: "Survei", icon: ClipboardList },
      { to: "/bantuan", label: "Bantuan", icon: Activity },
    ],
  },
  {
    id: "pengadaan",
    label: "Pengadaan/Belanja",
    icon: Church,
    items: [
      { to: "/gereja/pengadaan", label: "Belanja Gereja", icon: Church },
      { to: "/sekolah/pengadaan", label: "Belanja Sekolah", icon: GraduationCap },
    ],
  },
  // ============ ADMIN GROUPS ============
  {
    id: "admin-anggota",
    label: "Admin · Anggota",
    icon: Users,
    adminOnly: true,
    items: [
      { to: "/admin", label: "Dasbor Admin", icon: ShieldCheck, adminOnly: true },
      { to: "/admin/anggota", label: "Kelola Anggota", icon: Users, adminOnly: true },
      { to: "/admin/approval", label: "Approval Digital", icon: FileSignature, adminOnly: true },
      { to: "/admin/penagihan", label: "Penagihan (Collection)", icon: ShieldAlert, adminOnly: true },
    ],
  },
  {
    id: "admin-keuangan",
    label: "Admin · Keuangan",
    icon: Landmark,
    adminOnly: true,
    items: [
      { to: "/admin/simpanan", label: "Kelola Simpanan", icon: PiggyBank, adminOnly: true },
      { to: "/admin/pinjaman", label: "Kelola Pinjaman", icon: HandCoins, adminOnly: true },
      { to: "/admin/akad", label: "Status Akad", icon: FileSignature, adminOnly: true },
      { to: "/admin/verifikasi-pinjaman", label: "Verifikasi Pinjaman", icon: ShieldCheck, adminOnly: true },
      { to: "/admin/angsuran", label: "Kelola Angsuran", icon: Receipt, adminOnly: true },
      { to: "/admin/buku-besar", label: "Buku Besar Anggota", icon: BookOpen, adminOnly: true },
      { to: "/admin/buku-kas", label: "Buku Kas Harian", icon: BookText, adminOnly: true },
      { to: "/admin/arsip-transaksi", label: "Arsip Digital Transaksi", icon: Archive, adminOnly: true },
      { to: "/admin/rekonsiliasi", label: "Rekonsiliasi Bank", icon: Landmark, adminOnly: true },
      { to: "/admin/qris", label: "Verifikasi QRIS", icon: QrCode, adminOnly: true },
      { to: "/admin/tabungan-berjangka", label: "Tabungan Berjangka", icon: PiggyBank, adminOnly: true },
      { to: "/admin/dana-cadangan", label: "Dana Cadangan", icon: Wallet, adminOnly: true },
      { to: "/admin/shu", label: "Distribusi SHU", icon: Coins, adminOnly: true },
      { to: "/admin/penjamin", label: "Monitoring Penjamin", icon: Shield, adminOnly: true },
    ],
  },
  {
    id: "admin-marketplace",
    label: "Admin · Marketplace",
    icon: StoreIcon,
    adminOnly: true,
    items: [
      { to: "/admin/marketplace", label: "Manajemen Marketplace", icon: StoreIcon, adminOnly: true },
      { to: "/admin/seller-verify", label: "Verifikasi Seller", icon: ShieldCheck, adminOnly: true },
      { to: "/admin/escrow", label: "Escrow & Pencairan", icon: Wallet, adminOnly: true },
      { to: "/admin/fee", label: "Fee Marketplace", icon: Coins, adminOnly: true },
      { to: "/admin/komplain", label: "Komplain & Refund", icon: FileSignature, adminOnly: true },
      { to: "/admin/kupon", label: "Kupon & Promo", icon: Coins, adminOnly: true },
      { to: "/admin/statistik", label: "Statistik & Top Produk", icon: FileBarChart2, adminOnly: true },
    ],
  },
  {
    id: "admin-laporan",
    label: "Admin · Laporan",
    icon: FileBarChart2,
    adminOnly: true,
    items: [
      { to: "/admin/analitik", label: "Analitik", icon: Activity, adminOnly: true },
      { to: "/admin/laporan", label: "Laporan Keuangan", icon: FileBarChart2, adminOnly: true },
      { to: "/admin/laporan-rat", label: "Laporan RAT", icon: FileBarChart2, adminOnly: true },
      { to: "/admin/laporan-sak", label: "Laporan SAK ETAP", icon: FileBarChart2, adminOnly: true },
      { to: "/admin/rapb", label: "RAPB", icon: FileBarChart2, adminOnly: true },
    ],
  },
  {
    id: "admin-operasional",
    label: "Admin · Operasional",
    icon: SettingsIcon,
    adminOnly: true,
    items: [
      { to: "/admin/pengaturan", label: "Pengaturan Koperasi", icon: SettingsIcon, adminOnly: true },
      { to: "/admin/berita", label: "Berita & Kegiatan", icon: Newspaper, adminOnly: true },
      { to: "/admin/audit", label: "Audit Log", icon: Activity, adminOnly: true },
      { to: "/admin/aset", label: "Aset & Inventaris", icon: Package, adminOnly: true },
      { to: "/admin/opex", label: "OPEX (Operasional)", icon: Receipt, adminOnly: true },
      { to: "/admin/lowongan", label: "Kelola Lowongan", icon: Briefcase, adminOnly: true },
      { to: "/admin/notifikasi-wa", label: "Notifikasi WA", icon: Activity, adminOnly: true },
      { to: "/admin/support", label: "Tiket Support", icon: Activity, adminOnly: true },
      { to: "/admin/surat", label: "Surat Resmi", icon: FileSignature, adminOnly: true },
      { to: "/admin/survei", label: "Kelola Survei", icon: ClipboardList, adminOnly: true },
      { to: "/admin/voting", label: "Kelola Voting RAT", icon: FileSignature, adminOnly: true },
      { to: "/admin/gereja/pengadaan", label: "Belanja Gereja (Admin)", icon: Church, adminOnly: true },
      { to: "/admin/sekolah/pengadaan", label: "Belanja Sekolah (Admin)", icon: GraduationCap, adminOnly: true },
      { to: "/admin/backup", label: "Backup & Export Data", icon: DatabaseBackup, adminOnly: true },
    ],
  },
];

function AuthLayout() {
  const { user, profile, loading, signOut, roles, isPengurus, viewAsMember, setViewAsMember } = useAuth();
  // Saat "lihat sebagai anggota", perlakukan tanpa role admin
  const effRoles = viewAsMember ? [] : roles;
  const realPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const { data: isChurchRequester } = useQuery({
    queryKey: ["is-church-requester", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("church_requesters" as any)
        .select("id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
  });
  const { data: isSchoolRequester } = useQuery({
    queryKey: ["is-school-requester", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_requesters" as any)
        .select("id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
  });
  const visibleGroups = navGroups
    .map((g) => {
      if (g.id === "pengadaan") {
        return {
          ...g,
          items: g.items.filter((i) => {
            if (i.to === "/gereja/pengadaan") return isPengurus || !!isChurchRequester;
            if (i.to === "/sekolah/pengadaan") return isPengurus || !!isSchoolRequester;
            return true;
          }),
        };
      }
      if (g.adminOnly) {
        // Tampilkan hanya item yang boleh diakses sesuai job-desc role
        return { ...g, items: g.items.filter((i) => canAccessAdminPath(effRoles, i.to)) };
      }
      return g;
    })
    .filter((g) => {
      if (g.adminOnly) return g.items.length > 0;
      if (g.id === "pengadaan") return isPengurus || !!isChurchRequester || !!isSchoolRequester;
      return true;
    });

  const mobileNav = visibleGroups.flatMap((g) => g.items).slice(0, 4);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

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
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#241e1e] no-underline hover:no-underline transition-colors",
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
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Buka menu">
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] max-w-[340px] p-0 flex flex-col">
                <SheetHeader className="border-b px-5 py-4">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <div className="h-7 w-7 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
                    <span>T-COOL <span className="text-primary">Koperasi</span></span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-3 border-b px-5 py-3">
                  <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{profile?.nama_lengkap ?? "Anggota"}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile?.nomor_anggota ?? "—"}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-semibold">
                    {roleLabel(roles, viewAsMember)}
                  </Badge>
                </div>
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
                              "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold no-underline hover:no-underline transition-colors",
                              groupActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted",
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
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                      active
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-foreground/70 hover:bg-muted",
                                    )}
                                  >
                                    <n.icon className="h-4 w-4" />
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
                <div className="border-t p-3">
                  <Button variant="outline" className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" /> Keluar
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
              <span className="font-bold">T-COOL</span>
            </Link>
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
                    if (!viewAsMember) {
                      if (!pathname.startsWith("/admin")) navigate({ to: "/admin" });
                      return;
                    }
                    setViewAsMember(false);
                    toast.success("Mode Pengurus aktif", { description: "Akses pengurus dipulihkan." });
                    navigate({ to: "/admin" });
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
            <CommandPalette />
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
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {mobileNav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link key={n.to} to={n.to} className={cn("flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[10px] font-medium leading-tight text-center px-1", active ? "text-primary" : "text-muted-foreground")}>
                  <n.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate w-full">{n.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[10px] font-medium leading-tight text-muted-foreground active:bg-muted"
              aria-label="Buka semua menu"
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span>Menu</span>
            </button>
          </div>
        </nav>
      </div>
      
    </div>
  );
}