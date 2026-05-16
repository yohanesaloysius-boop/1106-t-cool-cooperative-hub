import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  UserPlus,
  Star,
  Clock,
  
  Wallet,
  ShieldAlert,
  UserCog,
  Briefcase,
  Phone,
  MapPin,
  Plus,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteFooter, SiteHeader } from "@/components/site-header";

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

type PublicStats = {
  total: number;
  aktif: number;
  pending: number;
  nonaktif: number;
  baru30: number;
  growth: { m: string; v: number; baru: number }[];
  distribusi: { aktif: number; pending: number; suspended: number; rejected: number };
};

const fmtNum = new Intl.NumberFormat("id-ID");

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Baru saja";
  if (m < 60) return `${m} menit yang lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam yang lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari yang lalu`;
}

const ACTIVITY_META: Record<string, { icon: typeof Users; color: string }> = {
  member: { icon: Users, color: "bg-emerald-100 text-emerald-700" },
  simpanan: { icon: Wallet, color: "bg-sky-100 text-sky-700" },
  pinjaman: { icon: ShieldAlert, color: "bg-amber-100 text-amber-700" },
  default: { icon: UserCog, color: "bg-violet-100 text-violet-700" },
};

function Landing() {
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["public-koperasi-stats"],
    queryFn: async (): Promise<PublicStats> => {
      const { data, error } = await (supabase.rpc as any)("get_public_koperasi_stats");
      if (error) throw error;
      return data as PublicStats;
    },
    staleTime: 30_000,
  });

  const { data: activities, refetch: refetchActivity } = useQuery({
    queryKey: ["public-recent-activity"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_recent_activity", { limit_count: 5 });
      if (error) throw error;
      return (data ?? []) as { kind: string; title: string; descr: string; ts: string }[];
    },
    staleTime: 30_000,
  });

  const { data: lowongan, refetch: refetchLowongan } = useQuery({
    queryKey: ["public-lowongan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lowongan_kerja")
        .select("id,judul,perusahaan,posisi,gender,lokasi,kontak_nama,kontak_telepon,deskripsi,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Realtime: refresh on any change to profiles / simpanan / pinjaman / lowongan
  useEffect(() => {
    const ch = supabase
      .channel("public-landing-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        refetchStats();
        refetchActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "simpanan" }, () => refetchActivity())
      .on("postgres_changes", { event: "*", schema: "public", table: "pinjaman" }, () => refetchActivity())
      .on("postgres_changes", { event: "*", schema: "public", table: "lowongan_kerja" }, () => refetchLowongan())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetchStats, refetchActivity, refetchLowongan]);

  const growthData = (stats?.growth ?? []).map((g) => ({ m: g.m, v: g.v }));
  const sparkFromGrowth = (stats?.growth ?? []).map((g) => g.v);
  const sparkBaru = (stats?.growth ?? []).map((g) => g.baru);
  const statCards = [
    {
      icon: Users,
      label: "Total Anggota",
      sub: "Jumlah seluruh anggota terdaftar",
      value: stats?.total ?? 0,
      tint: "from-emerald-300 to-emerald-500",
      spark: "var(--chart-1)",
      data: sparkFromGrowth.length ? sparkFromGrowth : [0, 0, 0, 0, 0, 0],
    },
    {
      icon: UserPlus,
      label: "Anggota Baru",
      sub: "Pendaftaran 30 hari terakhir",
      value: stats?.baru30 ?? 0,
      tint: "from-sky-300 to-blue-500",
      spark: "#3b82f6",
      data: sparkBaru.length ? sparkBaru : [0, 0, 0, 0, 0, 0],
    },
    {
      icon: Star,
      label: "Anggota Aktif",
      sub: "Status terverifikasi",
      value: stats?.aktif ?? 0,
      tint: "from-amber-300 to-orange-400",
      spark: "#f59e0b",
      data: sparkFromGrowth.length ? sparkFromGrowth : [0, 0, 0, 0, 0, 0],
    },
    {
      icon: Clock,
      label: "Tidak Aktif",
      sub: "Suspended / ditolak",
      value: stats?.nonaktif ?? 0,
      tint: "from-violet-300 to-purple-500",
      spark: "#a855f7",
      data: sparkBaru.length ? sparkBaru : [0, 0, 0, 0, 0, 0],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 pt-8 pb-20 md:pt-10">
        {/* HERO ROW */}
        <section className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Left copy */}
          <div className="lg:col-span-7 flex flex-col justify-center">
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
            </div>
          </div>

          {/* Marketplace Komunitas — preview card */}
          <Link
            to="/marketplace"
            className="lg:col-span-5 group block"
          >
            <div
              className="h-full rounded-3xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Marketplace Komunitas
                </span>
                <span className="text-xs font-medium text-primary group-hover:underline">Jelajahi →</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop",
                  "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=300&fit=crop",
                  "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=300&h=300&fit=crop",
                  "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&h=300&fit=crop",
                  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&h=300&fit=crop",
                  "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&h=300&fit=crop",
                ].map((src, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl ring-1 ring-border">
                    <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold">Belanja dari anggota, untuk anggota.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kuliner, fashion, kerajinan, dan jasa dari sesama anggota koperasi T-COOL.
              </p>
            </div>
          </Link>
        </section>

        {/* STAT CARDS */}
        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
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
              <p className="mt-3 text-2xl font-bold tabular-nums">{fmtNum.format(s.value)}</p>
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

        {/* LOWONGAN + AKTIVITAS */}
        <section className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* INFO LOWONGAN KERJA */}
          <div
            className="lg:col-span-5 rounded-3xl border border-border bg-card p-6"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Briefcase className="h-4 w-4" />
                </span>
                <h3 className="text-lg font-semibold">Info Lowongan Kerja</h3>
              </div>
              <Link to="/auth">
                <Button size="sm" variant="outline" className="rounded-full text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Pasang
                </Button>
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Anggota & pengurus dapat memasang info lowongan setelah disetujui pengurus.
            </p>
            <ul className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {(lowongan ?? []).length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">Belum ada lowongan.</li>
              ) : (
                lowongan!.map((l: any) => (
                  <li
                    key={l.id}
                    className="rounded-2xl border border-border/60 bg-background/60 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{l.judul}</p>
                        <p className="text-xs text-muted-foreground">{l.perusahaan}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                        {l.gender}
                      </Badge>
                    </div>
                    {l.deskripsi && (
                      <p className="mt-2 line-clamp-2 text-xs text-foreground/70">{l.deskripsi}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {l.posisi}
                      </span>
                      {l.lokasi && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {l.lokasi}
                        </span>
                      )}
                      <a
                        href={`tel:${l.kontak_telepon}`}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Phone className="h-3 w-3" /> {l.kontak_telepon}
                      </a>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* AKTIVITAS TERBARU — auto-scroll marquee */}
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
            {(activities ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
            ) : (
              <div
                className="relative mt-5 overflow-hidden"
                style={{ height: 360, maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)" }}
              >
                <ul className="flex flex-col gap-3 animate-marquee-y">
                  {[...(activities ?? []).slice(0, 5), ...(activities ?? []).slice(0, 5)].map((a, idx) => {
                    const meta = ACTIVITY_META[a.kind] ?? ACTIVITY_META.default;
                    const Icon = meta.icon;
                    return (
                      <li
                        key={idx}
                        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3"
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{a.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.descr}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.ts)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

