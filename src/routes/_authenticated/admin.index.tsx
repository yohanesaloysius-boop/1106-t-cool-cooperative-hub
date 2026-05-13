import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, PiggyBank, HandCoins, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — T-COOL Koperasi" }] }),
  component: AdminDashboard,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [members, pendingMembers, simpanan, pendingSimpanan, pinjamanPending, totalPinjaman] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("simpanan").select("nominal").eq("status", "verified"),
        supabase.from("simpanan").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("pinjaman").select("id", { count: "exact", head: true }).in("status", ["pending_sekretaris", "pending_bendahara", "pending_ketua"]),
        supabase.from("pinjaman").select("nominal").in("status", ["disbursed", "approved"]),
      ]);
      const totalSimpanan = (simpanan.data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      const sumPinjaman = (totalPinjaman.data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
      return {
        members: members.count ?? 0,
        pendingMembers: pendingMembers.count ?? 0,
        totalSimpanan,
        pendingSimpanan: pendingSimpanan.count ?? 0,
        pinjamanPending: pinjamanPending.count ?? 0,
        sumPinjaman,
      };
    },
  });

  const cards = [
    { label: "Total Anggota", value: data?.members ?? 0, icon: Users, hint: `${data?.pendingMembers ?? 0} menunggu aktivasi`, to: "/admin/anggota" },
    { label: "Total Simpanan", value: fmt.format(data?.totalSimpanan ?? 0), icon: PiggyBank, hint: `${data?.pendingSimpanan ?? 0} setoran perlu verifikasi`, to: "/admin/simpanan" },
    { label: "Pinjaman Pending", value: data?.pinjamanPending ?? 0, icon: AlertCircle, hint: "Perlu approval pengurus", to: "/admin/pinjaman" },
    { label: "Total Pinjaman", value: fmt.format(data?.sumPinjaman ?? 0), icon: HandCoins, hint: "Disetujui & dicairkan", to: "/admin/pinjaman" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Pantau aktivitas koperasi & lakukan approval secara realtime.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{isLoading ? "—" : c.value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{c.hint}</p>
              <Button asChild size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs">
                <Link to={c.to}>Lihat <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
