import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoanCalculator } from "@/components/dashboard/loan-calculator";
import { PiggyBank, HandCoins, Receipt, Wallet, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — T-COOL Koperasi" }] }),
  component: DashboardPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
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

  const stats = [
    { label: "Saldo Simpanan", value: data?.totalSimpanan ?? 0, icon: PiggyBank, accent: "text-primary" },
    { label: "Total Pinjaman", value: data?.totalPinjaman ?? 0, icon: HandCoins, accent: "text-foreground" },
    { label: "Sisa Angsuran", value: data?.sisaAngsuran ?? 0, icon: Receipt, accent: "text-warning" },
    { label: "SHU Diterima", value: data?.totalShu ?? 0, icon: Wallet, accent: "text-success" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <div className="rounded-2xl p-6 md:p-8 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-white/70">Anggota</p>
            <h1 className="text-2xl md:text-3xl font-bold">{profile?.nama_lengkap ?? "—"}</h1>
            <p className="mt-1 text-sm text-white/80">No. Anggota: <span className="font-mono">{profile?.nomor_anggota ?? "—"}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-white/15 text-white border-0 backdrop-blur">
              Status: {profile?.status ?? "pending"}
            </Badge>
            {data?.overdue ? (
              <Badge className="bg-destructive border-0">{data.overdue} angsuran lewat jatuh tempo</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} style={{ boxShadow: "var(--shadow-card)" }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.accent}`} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight">
                {isLoading ? "…" : fmt.format(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calculator + recent */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LoanCalculator
            onApply={(input) => {
              navigate({
                to: "/pinjaman",
                search: input as never,
              });
            }}
          />
        </div>
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader><CardTitle className="flex items-center justify-between">Aksi Cepat <ArrowUpRight className="h-4 w-4 text-muted-foreground" /></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <QuickAction title="Setor Simpanan" desc="Pokok, wajib, atau sukarela" onClick={() => navigate({ to: "/simpanan" })} />
            <QuickAction title="Ajukan Pinjaman" desc="Mulai dari simulasi cicilan" onClick={() => navigate({ to: "/pinjaman" })} />
            <QuickAction title="Bayar Angsuran" desc="Upload bukti transfer" onClick={() => navigate({ to: "/angsuran" })} />
            <QuickAction title="Lihat SHU" desc="Riwayat pembagian SHU" onClick={() => navigate({ to: "/shu" })} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center justify-between rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
    </button>
  );
}