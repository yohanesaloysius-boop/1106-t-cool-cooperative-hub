import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtIDR, getAdminStats, getFeeBreakdown, getTopProducts } from "@/lib/escrow-api";
import { TrendingUp, Package, ShoppingBag, AlertTriangle, Loader2, Trophy } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/statistik")({
  component: StatistikPage,
});

function StatistikPage() {
  const stats = useQuery({ queryKey: ["mp-admin-stats"], queryFn: getAdminStats });
  const top = useQuery({ queryKey: ["mp-top-products"], queryFn: () => getTopProducts(10) });
  const chart = useQuery({ queryKey: ["mp-fee-breakdown"], queryFn: getFeeBreakdown });

  const byStatus = stats.data?.by_status ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Statistik & Produk Terlaris</h1>
        <p className="text-sm text-muted-foreground">Ringkasan performa marketplace komunitas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={TrendingUp} label="GMV (Verified)" value={fmtIDR(Number(stats.data?.gmv ?? 0))} />
        <StatCard icon={Package} label="Pesanan Selesai" value={String(stats.data?.completed ?? 0)} />
        <StatCard icon={ShoppingBag} label="Perlu Verifikasi" value={String(stats.data?.pending_verif ?? 0)} highlight={Number(stats.data?.pending_verif ?? 0) > 0} />
        <StatCard icon={AlertTriangle} label="Komplain Terbuka" value={String(stats.data?.open_complaints ?? 0)} highlight={Number(stats.data?.open_complaints ?? 0) > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tren GMV Bulanan</CardTitle></CardHeader>
          <CardContent className="h-64">
            {chart.isLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart.data ?? []}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="bulan" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => fmtIDR(Number(v))} />
                  <Area type="monotone" dataKey="total_gmv" stroke="hsl(var(--primary))" fill="url(#g1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status Pesanan</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(byStatus).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs uppercase text-muted-foreground">{k}</p>
                  <p className="mt-1 text-xl font-bold">{String(v)}</p>
                </div>
              ))}
              {Object.keys(byStatus).length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">Belum ada data.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top 10 Produk Terlaris</CardTitle></CardHeader>
        <CardContent>
          {top.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (top.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada penjualan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">#</th>
                    <th className="text-left">Produk</th>
                    <th className="text-left">Toko</th>
                    <th className="text-right">Qty Terjual</th>
                    <th className="text-right">Omset</th>
                  </tr>
                </thead>
                <tbody>
                  {top.data!.map((p: any, i: number) => (
                    <tr key={p.product_id} className="border-b border-border/40">
                      <td className="py-2">
                        {i < 3 ? (
                          <Badge className="rounded-full bg-amber-500/15 text-amber-700">#{i + 1}</Badge>
                        ) : `#${i + 1}`}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 overflow-hidden rounded-lg bg-muted">
                            {p.gambar && <img src={p.gambar} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <span className="line-clamp-1">{p.nama_produk}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{p.store_nama}</td>
                      <td className="text-right font-semibold">{p.total_qty}</td>
                      <td className="text-right font-semibold text-primary">{fmtIDR(Number(p.total_omset))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-amber-500/50" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 ${highlight ? "bg-amber-500/15 text-amber-700" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
