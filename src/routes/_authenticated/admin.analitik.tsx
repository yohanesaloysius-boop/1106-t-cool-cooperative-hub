import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getKoperasiAnalytics, getAiInsight } from "@/lib/analytics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, TrendingUp, AlertTriangle, Users, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/analitik")({
  head: () => ({ meta: [{ title: "Analitik & AI — Admin" }] }),
  component: AnalitikPage,
});

const fmt = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

function AnalitikPage() {
  const fetcher = useServerFn(getKoperasiAnalytics);
  const insightFn = useServerFn(getAiInsight);
  const { data, isLoading } = useQuery({
    queryKey: ["koperasi-analytics"],
    queryFn: () => fetcher(),
  });

  const [insight, setInsight] = useState<string>("");
  const mut = useMutation({
    mutationFn: async () => {
      if (!data) return { insight: "", error: true as const };
      const summary = `Total inflow 12 bln: ${data.totals.inflow12m}. Outflow: ${data.totals.outflow12m}. Net: ${data.totals.inflow12m - data.totals.outflow12m}. Angsuran overdue: ${data.totals.overdueCount} (nominal ${data.totals.overdueNominal}). Anggota: ${data.totals.members}. Forecast 3 bln: ${JSON.stringify(data.forecast)}. Tren 12 bulan: ${JSON.stringify(data.series.map((s) => ({ m: s.month, in: s.inflow, out: s.outflow })))}.`;
      return await insightFn({ data: { summary } });
    },
    onSuccess: (r) => setInsight(r?.insight ?? ""),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const cashflow = [
    ...data.series.map((s) => ({ ...s, kind: "Aktual" })),
    ...data.forecast.map((s) => ({ ...s, kind: "Prediksi" })),
  ];
  const net12m = data.totals.inflow12m - data.totals.outflow12m;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="secondary" className="mb-2 bg-white/20 text-primary-foreground"><Sparkles className="h-3 w-3" /> AI Powered</Badge>
            <h1 className="text-2xl md:text-3xl font-bold text-[#372f2f]">Analitik & Prediksi</h1>
            <p className="text-sm text-[#3e3232] mt-1">Tren keuangan 12 bulan + forecast 3 bulan ke depan.</p>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg" variant="secondary" className="bg-white/20 text-primary-foreground hover:bg-white/30">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Minta Insight AI
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Inflow 12 bln</p>
          <p className="text-xl font-bold text-success">{fmt(data.totals.inflow12m)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Outflow 12 bln</p>
          <p className="text-xl font-bold text-destructive">{fmt(data.totals.outflow12m)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={`text-xl font-bold ${net12m >= 0 ? "text-success" : "text-destructive"}`}>{fmt(net12m)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Angsuran Overdue</p>
          <p className="text-xl font-bold text-warning">{data.totals.overdueCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{fmt(data.totals.overdueNominal)}</p>
        </CardContent></Card>
      </div>

      {insight && (
        <Card style={{ boxShadow: "var(--shadow-card)" }} className="border-primary/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Insight AI</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">{insight}</pre>
          </CardContent>
        </Card>
      )}

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Arus Kas (12 bulan + 3 bulan prediksi)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={cashflow}>
              <defs>
                <linearGradient id="in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend />
              <Area type="monotone" dataKey="inflow" name="Inflow" stroke="hsl(var(--success))" fill="url(#in)" />
              <Area type="monotone" dataKey="outflow" name="Outflow" stroke="hsl(var(--destructive))" fill="url(#out)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">3 bulan terakhir di grafik adalah prediksi berbasis rata-rata 6 bulan terakhir.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" /> Tren Angsuran Macet</CardTitle></CardHeader>
          <CardContent>
            {data.overdueTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada angsuran macet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.overdueTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--warning))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-destructive" /> Anggota Berisiko Tinggi</CardTitle></CardHeader>
          <CardContent>
            {data.topRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Semua anggota lancar 🎉</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topRisk} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="nama" type="category" fontSize={11} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
