import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { MarketplaceActivityCard } from "@/components/marketplace/marketplace-activity-card";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, UserCheck, UserPlus, UserX, Sparkles, ArrowUpRight, TrendingUp, PiggyBank, HandCoins, CalendarClock, Wallet } from "lucide-react";
import hero3d from "@/assets/hero-3d.png";
import { PushToggle } from "@/components/notifications/push-toggle";

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — T-Cool Koperasi" }] }),
  component: DashboardPage,
});

const fmtNum = new Intl.NumberFormat("id-ID");

function DashboardPage() {
  const { user, profile, isPengurus } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-anggota-stats"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("profiles")
        .select("id,status,created_at")
        .order("created_at", { ascending: true });
      const list = rows ?? [];
      const total = list.length;
      const aktif = list.filter((r: any) => r.status === "active").length;
      const pending = list.filter((r: any) => r.status === "pending").length;
      const nonaktif = list.filter((r: any) => ["suspended", "rejected"].includes(r.status)).length;

      // Growth: cumulative members per month, last 8 months
      const now = new Date();
      const months: { key: string; label: string; date: Date }[] = [];
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: d.toLocaleDateString("id-ID", { month: "short" }),
          date: d,
        });
      }
      const growth = months.map((m, idx) => {
        const cutoff = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 1);
        const total = list.filter((r: any) => new Date(r.created_at) < cutoff).length;
        const baru = list.filter((r: any) => {
          const c = new Date(r.created_at);
          return c >= m.date && c < cutoff;
        }).length;
        return { bulan: m.label, total, baru };
      });

      // Distribution by status
      const distribusi = [
        { name: "Aktif", value: aktif },
        { name: "Pending", value: pending },
        { name: "Suspended", value: list.filter((r: any) => r.status === "suspended").length },
        { name: "Rejected", value: list.filter((r: any) => r.status === "rejected").length },
      ].filter((d) => d.value > 0);

      // Member 30 hari terakhir
      const last30 = new Date(Date.now() - 30 * 86400000);
      const baru30 = list.filter((r: any) => new Date(r.created_at) >= last30).length;

      return { total, aktif, pending, nonaktif, growth, distribusi, baru30 };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dash-profiles-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  // Ringkasan keuangan pribadi anggota
  const { data: myFin } = useQuery({
    enabled: !!user?.id,
    queryKey: ["dashboard-my-fin", user?.id],
    queryFn: async () => {
      const uid = user!.id;
      const [simpRes, pinjRes, angsRes] = await Promise.all([
        supabase.from("simpanan").select("jenis,nominal,status").eq("user_id", uid).is("deleted_at", null),
        supabase.from("pinjaman").select("id,nominal,total_bayar,status").eq("user_id", uid).is("deleted_at", null),
        supabase.from("angsuran").select("id,nominal,jatuh_tempo,status,cicilan_ke").eq("user_id", uid).eq("status", "unpaid").is("deleted_at", null).order("jatuh_tempo", { ascending: true }).limit(1),
      ]);
      const simp = simpRes.data ?? [];
      const verified = simp.filter((s: any) => s.status === "verified");
      const byJenis = (j: string) => verified.filter((s: any) => s.jenis === j).reduce((a: number, b: any) => a + Number(b.nominal || 0), 0);
      const totalSimpanan = verified.reduce((a: number, b: any) => a + Number(b.nominal || 0), 0);
      const pokok = byJenis("pokok");
      const wajib = byJenis("wajib");
      const sukarela = byJenis("sukarela");

      const pinj = pinjRes.data ?? [];
      const pinjamanAktif = pinj.filter((p: any) => ["approved", "disbursed", "active"].includes(p.status));
      const totalPinjamanAktif = pinjamanAktif.reduce((a: number, b: any) => a + Number(b.total_bayar || b.nominal || 0), 0);

      // Sisa = total_bayar pinjaman aktif − total nominal angsuran yang sudah paid
      const pinjIds = pinjamanAktif.map((p: any) => p.id);
      let dibayar = 0;
      if (pinjIds.length) {
        const { data: paid } = await supabase
          .from("angsuran")
          .select("nominal")
          .in("pinjaman_id", pinjIds)
          .eq("status", "paid")
          .is("deleted_at", null);
        dibayar = (paid ?? []).reduce((a: number, b: any) => a + Number(b.nominal || 0), 0);
      }
      const sisaPinjaman = Math.max(0, totalPinjamanAktif - dibayar);

      const next = angsRes.data?.[0];
      return { pokok, wajib, sukarela, totalSimpanan, sisaPinjaman, pinjamanAktifCount: pinjamanAktif.length, nextAngsuran: next };
    },
  });

  const pieColors = useMemo(() => ["var(--primary)", "var(--primary-glow)", "var(--warning)", "var(--destructive)"], []);

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
    >
      {/* 1+2. Hero Section dengan ilustrasi 3D utama */}
      <motion.section
        variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
        className="glass relative overflow-hidden rounded-[2rem] p-6 md:p-10"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-soft)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 animate-float-slow rounded-full bg-white/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 animate-float rounded-full bg-primary/15 blur-3xl" />

        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <motion.span
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur"
            >
              <Sparkles className="h-3 w-3 animate-pulse" /> T-Cool Koperasi
            </motion.span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Halo,{" "}
              <span className="shimmer-text">
                {profile?.nama_lengkap?.split(" ")[0] ?? "Anggota"}
              </span>{" "}
              👋
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
              Pantau pertumbuhan anggota dan aktivitas koperasi dalam satu dashboard yang ringan dan modern.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={() => navigate({ to: "/simpanan" })} className="rounded-full px-5 shadow-sm animate-glow">
                  Setor Simpanan
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button variant="outline" onClick={() => navigate({ to: "/pinjaman" })} className="rounded-full bg-white/70 px-5 backdrop-blur">
                  Ajukan Pinjaman
                </Button>
              </motion.div>
              <Badge variant="secondary" className="rounded-full bg-white/70 px-3 py-1 text-primary border-0 backdrop-blur capitalize">
                {profile?.status ?? "pending"}
              </Badge>
              <PushToggle />
            </div>
          </div>

          {/* 3. Ilustrasi 3D utama */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="absolute inset-x-8 bottom-2 h-10 rounded-full bg-primary/20 blur-2xl" />
            <motion.img
              src={hero3d}
              alt="Ilustrasi 3D dashboard koperasi"
              width={1024}
              height={1024}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-sm animate-float drop-shadow-xl md:max-w-md"
            />
          </div>
        </div>
      </motion.section>

      {/* Onboarding checklist — auto hide kalau semua selesai */}
      {!isPengurus && <OnboardingChecklist />}

      {/* Ringkasan keuangan pribadi anggota */}
      <motion.section
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <FinTile
          label="Total Simpanan"
          value={fmtRp(myFin?.totalSimpanan ?? 0)}
          icon={PiggyBank}
          tone="primary"
          hint={`Pokok ${fmtRp(myFin?.pokok ?? 0)} • Wajib ${fmtRp(myFin?.wajib ?? 0)}`}
          onClick={() => navigate({ to: "/simpanan" })}
        />
        <FinTile
          label="Simpanan Sukarela"
          value={fmtRp(myFin?.sukarela ?? 0)}
          icon={Wallet}
          tone="success"
          hint="Saldo fleksibel Anda"
          onClick={() => navigate({ to: "/simpanan" })}
        />
        <FinTile
          label="Sisa Pinjaman"
          value={fmtRp(myFin?.sisaPinjaman ?? 0)}
          icon={HandCoins}
          tone="warning"
          hint={
            (myFin?.pinjamanAktifCount ?? 0) > 0
              ? `${myFin?.pinjamanAktifCount} pinjaman aktif`
              : "Belum ada pinjaman aktif"
          }
          onClick={() => navigate({ to: "/pinjaman" })}
        />
        <FinTile
          label="Angsuran Berikutnya"
          value={myFin?.nextAngsuran ? fmtRp(Number(myFin.nextAngsuran.nominal)) : "—"}
          icon={CalendarClock}
          tone="muted"
          hint={
            myFin?.nextAngsuran
              ? `Cicilan ke-${myFin.nextAngsuran.cicilan_ke} • jatuh tempo ${new Date(myFin.nextAngsuran.jatuh_tempo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
              : "Tidak ada angsuran tertunggak"
          }
          onClick={() => navigate({ to: "/angsuran" })}
        />
      </motion.section>

      {/* 5. 4 Kartu statistik anggota — hanya pengurus */}
      {isPengurus && (
      <motion.section
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile label="Total Anggota" value={data?.total ?? 0} icon={Users} tone="primary" hint="Seluruh anggota terdaftar" loading={isLoading} />
        <StatTile label="Anggota Aktif" value={data?.aktif ?? 0} icon={UserCheck} tone="success" hint="Status terverifikasi" loading={isLoading} />
        <StatTile label="Menunggu Verifikasi" value={data?.pending ?? 0} icon={UserPlus} tone="warning" hint="Pendaftaran baru" loading={isLoading} />
        <StatTile label="Tidak Aktif" value={data?.nonaktif ?? 0} icon={UserX} tone="muted" hint="Suspended / ditolak" loading={isLoading} />
      </motion.section>
      )}

      {/* 4 + 6. Grafik pertumbuhan + distribusi */}
      <motion.section
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <Card className="hover-lift lg:col-span-2 rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Pertumbuhan Anggota</CardTitle>
              <CardDescription>Jumlah anggota kumulatif 8 bulan terakhir</CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary border-0">
              <TrendingUp className="mr-1 h-3 w-3" /> +{data?.baru30 ?? 0} / 30 hari
            </Badge>
          </CardHeader>
          <CardContent className="h-[280px] pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.growth ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMint" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="bulan" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => fmtNum.format(v)}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#gMint)"
                  isAnimationActive
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover-lift rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Anggota</CardTitle>
            <CardDescription>Berdasarkan status keanggotaan</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pt-0">
            {(data?.distribusi.length ?? 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.distribusi ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="var(--card)"
                    strokeWidth={3}
                    isAnimationActive
                    animationDuration={1100}
                    animationEasing="ease-out"
                  >
                    {(data?.distribusi ?? []).map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => fmtNum.format(v)}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* 7. Aktivitas terbaru anggota */}
      <motion.section
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <ActivityFeed limit={8} />
        </div>
        <Card className="hover-lift rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Aksi Cepat
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>Pintasan layanan koperasi</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            <QuickRow label="Setor Simpanan" desc="Pokok / wajib / sukarela" onClick={() => navigate({ to: "/simpanan" })} />
            <QuickRow label="Ajukan Pinjaman" desc="Mulai dari simulasi" onClick={() => navigate({ to: "/pinjaman" })} />
            <QuickRow label="Bayar Angsuran" desc="Upload bukti transfer" onClick={() => navigate({ to: "/angsuran" })} />
            <QuickRow label="Buka Toko" desc="Marketplace komunitas" onClick={() => navigate({ to: "/marketplace-saya" })} />
            <QuickRow label="Lihat SHU" desc="Riwayat pembagian" onClick={() => navigate({ to: "/shu" })} />
            <QuickRow label="Survei Kepuasan" desc="Beri masukan layanan" onClick={() => navigate({ to: "/survei" })} />
            <QuickRow label="E-Voting RAT" desc="Suara keputusan rapat" onClick={() => navigate({ to: "/voting" })} />
            <QuickRow label="Bantuan & Chat" desc="Hubungi pengurus" onClick={() => navigate({ to: "/bantuan" })} />
          </CardContent>
        </Card>
      </motion.section>

      {/* Aktivitas Marketplace anggota — integrasi marketplace ↔ dashboard */}
      <motion.section
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <MarketplaceActivityCard limit={5} />
        </div>
        <Card className="hover-lift rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader>
            <CardTitle className="text-base">Saldo Koperasi</CardTitle>
            <CardDescription>Integrasi pembayaran marketplace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm"
            >
              <p className="font-semibold text-primary">Bayar pakai Saldo Simpanan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Segera hadir — gunakan saldo simpanan sukarela untuk bayar belanja marketplace
                & dapatkan cashback otomatis ke SHU.
              </p>
              <Badge variant="secondary" className="mt-2 rounded-full bg-warning/15 text-warning border-0">
                Coming soon
              </Badge>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => navigate({ to: "/marketplace" })}
            >
              Belanja di Marketplace
            </Button>
          </CardContent>
        </Card>
      </motion.section>
    </motion.div>
  );
}

const toneMap = {
  primary: "from-primary/15 to-transparent text-primary",
  success: "from-success/20 to-transparent text-success",
  warning: "from-warning/25 to-transparent text-warning",
  muted: "from-muted to-transparent text-muted-foreground",
} as const;

function FinTile({
  label, value, icon: Icon, tone, hint, onClick,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: keyof typeof toneMap;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <Card
        onClick={onClick}
        className="group relative cursor-pointer overflow-hidden rounded-3xl border-border/40"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneMap[tone]}`} />
        <CardContent className="relative p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className={`rounded-xl bg-white/70 p-2 backdrop-blur transition-transform duration-300 group-hover:scale-110 ${toneMap[tone].split(" ").pop()}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{hint}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatTile({
  label, value, icon: Icon, tone, hint, loading,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: keyof typeof toneMap;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <Card
        className="group relative overflow-hidden rounded-3xl border-border/40"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneMap[tone]}`} />
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/30 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
        <CardContent className="relative p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className={`rounded-xl bg-white/70 p-2 backdrop-blur transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${toneMap[tone].split(" ").pop()}`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-foreground">
            {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted" /> : fmtNum.format(value)}
          </p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickRow({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/60 p-3.5 text-left backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </button>
  );
}
