import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

interface Row { tanggal: string; arah: string; nominal: number; user_id?: string | null }

interface Props {
  userId?: string; // if set, scope to user
  title?: string;
  days?: number;
}

const fmtIDR = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function TransactionChart({ userId, title = "Grafik Transaksi", days = 30 }: Props) {
  const [data, setData] = useState<{ date: string; masuk: number; keluar: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    let q = supabase.from("transaksi").select("tanggal,arah,nominal,user_id").gte("tanggal", since.toISOString().slice(0, 10)).order("tanggal");
    if (userId) q = q.eq("user_id", userId);
    const { data: rows } = await q;
    const map = new Map<string, { masuk: number; keluar: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(5, 10), { masuk: 0, keluar: 0 });
    }
    (rows as Row[] | null)?.forEach((r) => {
      const k = r.tanggal.slice(5, 10);
      const cur = map.get(k) ?? { masuk: 0, keluar: 0 };
      if (r.arah === "in") cur.masuk += Number(r.nominal);
      else cur.keluar += Number(r.nominal);
      map.set(k, cur);
    });
    setData(Array.from(map.entries()).map(([date, v]) => ({ date, ...v })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`tx-chart-${userId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transaksi" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, days]);

  return (
    <Card className="border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{days} hari terakhir · realtime</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />LIVE
        </span>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <TrendingUp className="mr-2 h-4 w-4 animate-pulse" />Memuat grafik...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.17 150)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="oklch(0.62 0.17 150)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.78 0.15 80)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="oklch(0.78 0.15 80)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, name) => [fmtIDR.format(v), name === "masuk" ? "Masuk" : "Keluar"]}
                />
                <Area type="monotone" dataKey="masuk" stroke="oklch(0.62 0.17 150)" strokeWidth={2} fill="url(#gMasuk)" />
                <Area type="monotone" dataKey="keluar" stroke="oklch(0.78 0.15 80)" strokeWidth={2} fill="url(#gKeluar)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
