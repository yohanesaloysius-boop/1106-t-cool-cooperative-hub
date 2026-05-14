import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoanCalculator } from "@/components/dashboard/loan-calculator";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { TransactionChart } from "@/components/dashboard/transaction-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { FloatingActionButton } from "@/components/dashboard/floating-action";
import { PiggyBank, HandCoins, Receipt, Wallet, ArrowUpRight, Sparkles } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — T-COOL Koperasi" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [simpanan, pinjaman, angsuran, shu] = await Promise.all([
        supabase.from("simpanan").select("nominal,status").eq("user_id", user!.id),
        supabase.from("pinjaman").select("nominal,status,total_bayar").eq("user_id", user!.id),
        supabase.from("angsuran").select("nominal,status,jatuh_tempo").eq("user_id", user!.id),
        supabase.from("shu").select("nominal,tahun").eq("user_id", user!.id),
      ]);
      const totalSimpanan = (simpanan.data ?? []).filter((s) => s.status === "verified").reduce((a, b) => a + Number(b.nominal), 0);
      const totalPinjaman = (pinjaman.data ?? []).filter((p) => ["approved", "disbursed"].includes(p.status as string)).reduce((a, b) => a + Number(b.nominal), 0);
      const sisaAngsuran = (angsuran.data ?? []).filter((a) => a.status !== "paid").reduce((s, a) => s + Number(a.nominal), 0);
      const totalShu = (shu.data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const overdue = (angsuran.data ?? []).filter((a) => a.status !== "paid" && new Date(a.jatuh_tempo) < new Date()).length;
      return { totalSimpanan, totalPinjaman, sisaAngsuran, totalShu, overdue };
    },
  });

  // Realtime: refresh stats on relevant changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "simpanan", filter: `user_id=eq.${user.id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "pinjaman", filter: `user_id=eq.${user.id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "angsuran", filter: `user_id=eq.${user.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refetch]);

  return (
    <div className="space-y-6">
      {/* Hero — light glassmorphism */}
      <div
        className="glass relative overflow-hidden rounded-3xl p-6 md:p-10"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-soft)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur">
              <Sparkles className="h-3 w-3" /> T-Cool Koperasi
            </span>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Halo, {profile?.nama_lengkap?.split(" ")[0] ?? "Anggota"} 👋
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              No. Anggota <span className="font-mono text-foreground/80">{profile?.nomor_anggota ?? "—"}</span> · pantau keuanganmu kapan saja.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full bg-white/70 px-3 py-1 text-primary border-0 backdrop-blur capitalize">
              {profile?.status ?? "pending"}
            </Badge>
            {data?.overdue ? (
              <Badge className="rounded-full bg-destructive/90 border-0">{data.overdue} angsuran lewat jatuh tempo</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Saldo Simpanan" value={data?.totalSimpanan ?? 0} icon={PiggyBank} accent="primary" hint="Total simpanan terverifikasi" />
            <StatCard label="Total Pinjaman" value={data?.totalPinjaman ?? 0} icon={HandCoins} accent="success" hint="Aktif & dicairkan" />
            <StatCard label="Sisa Angsuran" value={data?.sisaAngsuran ?? 0} icon={Receipt} accent="warning" hint="Belum lunas" />
            <StatCard label="SHU Diterima" value={data?.totalShu ?? 0} icon={Wallet} accent="success" hint="Akumulasi semua tahun" />
          </>
        )}
      </div>

      {/* Chart + bills */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><TransactionChart userId={user?.id} title="Arus Kas Saya" /></div>
        <UpcomingBills userId={user!.id} />
      </div>

      {/* Activity + calculator */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LoanCalculator
            onApply={(input) => navigate({ to: "/pinjaman", search: input as never })}
          />
        </div>
        <ActivityFeed userId={user?.id} />
      </div>

      {/* Quick actions */}
      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle className="flex items-center justify-between text-base">Aksi Cepat <ArrowUpRight className="h-4 w-4 text-muted-foreground" /></CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction title="Setor Simpanan" desc="Pokok / wajib / sukarela" onClick={() => navigate({ to: "/simpanan" })} />
          <QuickAction title="Ajukan Pinjaman" desc="Mulai dari simulasi" onClick={() => navigate({ to: "/pinjaman" })} />
          <QuickAction title="Bayar Angsuran" desc="Upload bukti transfer" onClick={() => navigate({ to: "/angsuran" })} />
          <QuickAction title="Lihat SHU" desc="Riwayat pembagian" onClick={() => navigate({ to: "/shu" })} />
        </CardContent>
      </Card>

      <FloatingActionButton />
    </div>
  );
}

function QuickAction({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center justify-between rounded-xl border border-border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
    </button>
  );
}
