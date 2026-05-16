import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { TransactionChart } from "@/components/dashboard/transaction-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { LiveActivityFeed } from "@/components/dashboard/live-activity-feed";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpananVerifyPage } from "./admin.simpanan";
import { AdminAngsuranPage } from "./admin.angsuran";
import { PinjamanApprovalPage } from "./admin.pinjaman";
import { Users, PiggyBank, HandCoins, AlertCircle, Wallet, CalendarClock, ShieldCheck, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — T-COOL Koperasi" }] }),
  component: AdminDashboard,
});

const roleTitle: Record<AppRole, string> = {
  super_admin: "Super Admin",
  ketua: "Ketua",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  anggota: "Anggota",
};

function pickRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["super_admin", "ketua", "bendahara", "sekretaris", "anggota"];
  return order.find((r) => roles.includes(r)) ?? "anggota";
}

function AdminDashboard() {
  const { profile, roles } = useAuth();
  const primaryRole = pickRole(roles);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [members, pendingMembers, simpanan, pendingSimpanan, pinjamanPending, totalPinjaman, overdue, shu] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("simpanan").select("nominal").eq("status", "verified"),
        supabase.from("simpanan").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("pinjaman").select("id", { count: "exact", head: true }).in("status", ["pending_sekretaris", "pending_bendahara", "pending_ketua"]),
        supabase.from("pinjaman").select("nominal").in("status", ["disbursed", "approved"]),
        supabase.from("angsuran").select("id", { count: "exact", head: true }).neq("status", "paid").lt("jatuh_tempo", new Date().toISOString().slice(0, 10)),
        supabase.from("shu").select("nominal"),
      ]);
      const totalSimpanan = (simpanan.data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const sumPinjaman = (totalPinjaman.data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const totalShu = (shu.data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      return {
        members: members.count ?? 0,
        pendingMembers: pendingMembers.count ?? 0,
        totalSimpanan,
        pendingSimpanan: pendingSimpanan.count ?? 0,
        pinjamanPending: pinjamanPending.count ?? 0,
        sumPinjaman,
        overdue: overdue.count ?? 0,
        totalShu,
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-stats-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "simpanan" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "pinjaman" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "angsuran" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> {roleTitle[primaryRole]}
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold">Dashboard Pengurus</h1>
            <p className="mt-1 text-sm text-white/80">Halo, {profile?.nama_lengkap ?? "Pengurus"} · pantau koperasi secara realtime.</p>
          </div>
        </div>
      </div>

      {/* Stat cards (role-priority) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Anggota" value={data?.members ?? 0} format="number" icon={Users} accent="primary" hint={`${data?.pendingMembers ?? 0} menunggu aktivasi`} />
            <StatCard label="Total Simpanan" value={data?.totalSimpanan ?? 0} icon={PiggyBank} accent="success" hint={`${data?.pendingSimpanan ?? 0} setoran perlu verifikasi`} />
            <StatCard label="Total Pinjaman" value={data?.sumPinjaman ?? 0} icon={HandCoins} accent="warning" hint={`${data?.pinjamanPending ?? 0} pengajuan menunggu`} />
            <StatCard label="SHU Dibagikan" value={data?.totalShu ?? 0} icon={Wallet} accent="success" hint="Akumulasi semua tahun" />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Pengajuan Pinjaman" value={data?.pinjamanPending ?? 0} format="number" icon={AlertCircle} accent="warning" hint="Antri approval pengurus" loading={isLoading} />
        <StatCard label="Setoran Pending" value={data?.pendingSimpanan ?? 0} format="number" icon={PiggyBank} accent="primary" hint="Perlu verifikasi bendahara" loading={isLoading} />
        <StatCard label="Angsuran Lewat Tempo" value={data?.overdue ?? 0} format="number" icon={CalendarClock} accent="destructive" hint="Perlu penagihan" loading={isLoading} />
      </div>

      {/* Chart + approval queue */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><TransactionChart title="Arus Kas Koperasi" /></div>
        <ApprovalQueue />
      </div>

      {/* Pusat Verifikasi — gabungan Simpanan, Pinjaman, Angsuran */}
      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Pusat Verifikasi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="simpanan">
            <TabsList>
              <TabsTrigger value="simpanan">Verifikasi Simpanan</TabsTrigger>
              <TabsTrigger value="pinjaman">Approval Pinjaman</TabsTrigger>
              <TabsTrigger value="angsuran">Verifikasi Angsuran</TabsTrigger>
            </TabsList>
            <TabsContent value="simpanan" className="mt-4"><SimpananVerifyPage /></TabsContent>
            <TabsContent value="pinjaman" className="mt-4"><PinjamanApprovalPage /></TabsContent>
            <TabsContent value="angsuran" className="mt-4"><AdminAngsuranPage /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed limit={10} />
        <LiveActivityFeed limit={10} title="Live Audit Stream" />
      </div>
    </div>
  );
}
