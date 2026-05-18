import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtIDR, getAdminStats, getFeeBreakdown, getKoperasiWallet } from "@/lib/escrow-api";
import { Coins, Landmark, TrendingUp, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/fee")({
  component: AdminFeePage,
});

function AdminFeePage() {
  const stats = useQuery({ queryKey: ["mp-admin-stats"], queryFn: getAdminStats });
  const wallet = useQuery({ queryKey: ["mp-kop-wallet"], queryFn: getKoperasiWallet });
  const chart = useQuery({ queryKey: ["mp-fee-breakdown"], queryFn: getFeeBreakdown });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Fee Marketplace</h1>
        <p className="text-sm text-muted-foreground">Pendapatan fee koperasi dari setiap transaksi marketplace.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Coins} label="Total Fee Koperasi" value={fmtIDR(Number(wallet.data?.saldo ?? 0))} hint="Akumulasi dari semua transaksi selesai" />
        <StatCard icon={Landmark} label="Dana Ditahan (Escrow)" value={fmtIDR(Number(stats.data?.escrow_total ?? 0))} hint="Belum cair ke penjual" />
        <StatCard icon={TrendingUp} label="GMV (Paid+Shipped+Done)" value={fmtIDR(Number(stats.data?.gmv ?? 0))} hint="Nilai transaksi yang terverifikasi" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Fee per Bulan (12 bulan terakhir)</CardTitle></CardHeader>
        <CardContent className="h-72">
          {chart.isLoading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="bulan" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: any) => fmtIDR(Number(v))} />
                <Bar dataKey="total_fee" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rincian Bulanan</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr><th className="py-2 text-left">Bulan</th><th className="text-right">Transaksi</th><th className="text-right">GMV</th><th className="text-right">Fee Koperasi</th></tr>
              </thead>
              <tbody>
                {(chart.data ?? []).map((r) => (
                  <tr key={r.bulan} className="border-b border-border/40">
                    <td className="py-2">{r.bulan}</td>
                    <td className="text-right">{r.jumlah_trx}</td>
                    <td className="text-right">{fmtIDR(Number(r.total_gmv))}</td>
                    <td className="text-right font-semibold text-primary">{fmtIDR(Number(r.total_fee))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
        {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
