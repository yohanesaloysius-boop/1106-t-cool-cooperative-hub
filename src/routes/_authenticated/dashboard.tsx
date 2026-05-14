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
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, UserCheck, UserPlus, UserX, Sparkles, ArrowUpRight, TrendingUp } from "lucide-react";
import hero3d from "@/assets/hero-3d.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — T-Cool Koperasi" }] }),
  component: DashboardPage,
});

const fmtNum = new Intl.NumberFormat("id-ID");

function DashboardPage() {
  const { user, profile } = useAuth();
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

  const pieColors = useMemo(() => ["var(--primary)", "var(--primary-glow)", "var(--warning)", "var(--destructive)"], []);

  return (
    <div className="space-y-8">
      {/* 1+2. Hero Section dengan ilustrasi 3D utama */}
      <section
        className="glass relative overflow-hidden rounded-[2rem] p-6 md:p-10"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-soft)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" /> T-Cool Koperasi
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Halo, {profile?.nama_lengkap?.split(" ")[0] ?? "Anggota"} 👋
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
              Pantau pertumbuhan anggota dan aktivitas koperasi dalam satu dashboard yang ringan dan modern.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Button onClick={() => navigate({ to: "/simpanan" })} className="rounded-full px-5 shadow-sm">
                Setor Simpanan
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/pinjaman" })} className="rounded-full bg-white/70 px-5 backdrop-blur">
                Ajukan Pinjaman
              </Button>
              <Badge variant="secondary" className="rounded-full bg-white/70 px-3 py-1 text-primary border-0 backdrop-blur capitalize">
                {profile?.status ?? "pending"}
              </Badge>
            </div>
          </div>

          {/* 3. Ilustrasi 3D utama */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="absolute inset-x-8 bottom-2 h-10 rounded-full bg-primary/20 blur-2xl" />
            <img
              src={hero3d}
              alt="Ilustrasi 3D dashboard koperasi"
              width={1024}
              height={1024}
              className="relative mx-auto w-full max-w-sm drop-shadow-xl md:max-w-md"
            />
          </div>
        </div>
      </section>

      {/* 5. 4 Kartu statistik anggota */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total Anggota" value={data?.total ?? 0} icon={Users} tone="primary" hint="Seluruh anggota terdaftar" loading={isLoading} />
        <StatTile label="Anggota Aktif" value={data?.aktif ?? 0} icon={UserCheck} tone="success" hint="Status terverifikasi" loading={isLoading} />
        <StatTile label="Menunggu Verifikasi" value={data?.pending ?? 0} icon={UserPlus} tone="warning" hint="Pendaftaran baru" loading={isLoading} />
        <StatTile label="Tidak Aktif" value={data?.nonaktif ?? 0} icon={UserX} tone="muted" hint="Suspended / ditolak" loading={isLoading} />
      </section>

      {/* 4 + 6. Grafik pertumbuhan + distribusi */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
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
                <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gMint)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
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
      </section>

      {/* 7. Aktivitas terbaru anggota */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed limit={8} />
        </div>
        <Card className="rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
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
            <QuickRow label="Lihat SHU" desc="Riwayat pembagian" onClick={() => navigate({ to: "/shu" })} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

const toneMap = {
  primary: "from-primary/15 to-transparent text-primary",
  success: "from-success/20 to-transparent text-success",
  warning: "from-warning/25 to-transparent text-warning",
  muted: "from-muted to-transparent text-muted-foreground",
} as const;

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
    <Card
      className="group relative overflow-hidden rounded-3xl border-border/40 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneMap[tone]}`} />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className={`rounded-xl bg-white/70 p-2 backdrop-blur ${toneMap[tone].split(" ").pop()}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted" /> : fmtNum.format(value)}
        </p>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
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
