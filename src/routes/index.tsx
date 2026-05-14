import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  UserPlus,
  Star,
  Clock,
  Calculator,
  ChevronDown,
  Wallet,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import hero3d from "@/assets/hero-3d.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "T-COOL Koperasi — Koperasi Modern di Genggaman Anda" },
      {
        name: "description",
        content:
          "Kelola simpanan pokok, wajib, sukarela, ajukan pinjaman, dan pantau cicilan — semua dalam satu dasbor anggota yang elegan.",
      },
      { property: "og:title", content: "T-COOL Koperasi — Modern di Genggaman" },
      {
        property: "og:description",
        content: "Dasbor koperasi modern: simpanan, pinjaman, dan SHU realtime.",
      },
    ],
  }),
  component: Landing,
});

const growthData = [
  { m: "Des", v: 720 },
  { m: "Jan", v: 820 },
  { m: "Feb", v: 880 },
  { m: "Mar", v: 980 },
  { m: "Apr", v: 1110 },
  { m: "Mei", v: 1245 },
];

const distData = [
  { name: "Anggota Aktif", value: 65, color: "var(--chart-1)" },
  { name: "Anggota Non Aktif", value: 20, color: "var(--chart-2)" },
  { name: "Anggota Baru", value: 10, color: "var(--chart-3)" },
  { name: "Anggota Keluar", value: 5, color: "var(--chart-4)" },
];

const stats = [
  {
    icon: Users,
    label: "Total Anggota",
    sub: "Jumlah seluruh anggota aktif",
    tint: "from-emerald-300 to-emerald-500",
    spark: "var(--chart-1)",
    data: [4, 6, 5, 8, 7, 10, 12],
  },
  {
    icon: UserPlus,
    label: "Anggota Baru",
    sub: "Anggota baru bulan ini",
    tint: "from-sky-300 to-blue-500",
    spark: "#3b82f6",
    data: [2, 3, 5, 4, 7, 6, 9],
  },
  {
    icon: Star,
    label: "Anggota Aktif",
    sub: "Anggota aktif saat ini",
    tint: "from-amber-300 to-orange-400",
    spark: "#f59e0b",
    data: [5, 7, 6, 8, 7, 9, 11],
  },
  {
    icon: Clock,
    label: "Anggota Non Aktif",
    sub: "Anggota tidak aktif (> 6 bulan)",
    tint: "from-violet-300 to-purple-500",
    spark: "#a855f7",
    data: [3, 4, 3, 5, 4, 6, 5],
  },
];

const activities = [
  {
    icon: Users,
    color: "bg-emerald-100 text-emerald-700",
    title: "Anggota baru bergabung",
    desc: "Siti Nurhaliza mendaftar sebagai anggota",
    time: "2 menit yang lalu",
  },
  {
    icon: Wallet,
    color: "bg-sky-100 text-sky-700",
    title: "Pembayaran iuran bulanan",
    desc: "Budi Santoso melakukan pembayaran iuran",
    time: "1 jam yang lalu",
  },
  {
    icon: ShieldAlert,
    color: "bg-amber-100 text-amber-700",
    title: "Pengajuan pinjaman",
    desc: "Ahmad Wijaya mengajukan pinjaman",
    time: "3 jam yang lalu",
  },
  {
    icon: UserCog,
    color: "bg-violet-100 text-violet-700",
    title: "Perubahan data anggota",
    desc: "Dewi Lestari memperbarui data pribadi",
    time: "5 jam yang lalu",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 pt-8 pb-20 md:pt-10">
        {/* HERO ROW */}
        <section className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Left copy */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/70">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Terdaftar &amp; Aman
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              Koperasi Modern di
              <br />
              <span className="text-primary">Genggaman Anda</span>
            </h1>
            <p className="mt-5 text-base text-muted-foreground max-w-md">
              Kelola simpanan pokok, wajib, sukarela, ajukan pinjaman, dan
              pantau cicilan — semua dalam satu dasbor anggota yang elegan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "register" } as never}>
                <Button size="lg" className="rounded-full px-6 shadow-lg">
                  Daftar Sekarang <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-border bg-card px-6"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Kalkulator Pinjaman
              </Button>
            </div>
          </div>

          {/* Center 3D illustration */}
          <div className="lg:col-span-4 relative flex items-center justify-center">
            <div
              className="absolute inset-6 rounded-[3rem] blur-3xl opacity-60"
              style={{ background: "var(--gradient-mint)" }}
            />
            <img
              src={hero3d}
              alt="Ilustrasi 3D koperasi: gedung bank mini, brankas, dan tumpukan koin"
              className="relative w-full max-w-[420px] drop-shadow-[0_20px_40px_rgba(20,184,166,0.18)]"
            />
          </div>

          {/* Right growth chart */}
          <div className="lg:col-span-4">
            <div
              className="h-full rounded-3xl border border-border bg-card p-6"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">Pertumbuhan Anggota</h3>
                <button className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                  6 Bulan Terakhir <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="m" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}K` : `${v}`)}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        boxShadow: "var(--shadow-card)",
                      }}
                      labelStyle={{ color: "var(--muted-foreground)", fontSize: 12 }}
                      formatter={(v: number) => [`${v.toLocaleString("id-ID")} Anggota`, ""]}
                    />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      fill="url(#growthFill)"
                      dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* STAT CARDS */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${s.tint}`}
                >
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-tight">{s.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{s.sub}</p>
                </div>
              </div>
              <div className="mt-3 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.data.map((v, i) => ({ i, v }))}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={s.spark}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </section>

        {/* DISTRIBUSI + AKTIVITAS */}
        <section className="mt-8 grid gap-6 lg:grid-cols-12">
          <div
            className="lg:col-span-5 rounded-3xl border border-border bg-card p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h3 className="text-lg font-semibold">Distribusi Anggota</h3>
            <div className="mt-4 grid grid-cols-2 items-center gap-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distData}
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {distData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-3 text-sm">
                {distData.map((d) => (
                  <li key={d.name}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-foreground/80">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: d.color }}
                        />
                        {d.name}
                      </span>
                      <span className="font-semibold">{d.value}%</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${d.value}%`, background: d.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="lg:col-span-7 rounded-3xl border border-border bg-card p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Aktivitas Terbaru</h3>
              <button className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                Lihat Semua
              </button>
            </div>
            <ul className="mt-5 relative">
              <span className="absolute left-[11px] top-2 bottom-2 w-px bg-border" aria-hidden />
              {activities.map((a) => (
                <li key={a.title} className="relative flex items-start gap-4 py-3.5">
                  <span className="relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-card bg-primary shrink-0 ring-2 ring-primary/20" />
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.color}`}>
                    <a.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

