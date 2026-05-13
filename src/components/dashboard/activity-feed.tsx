import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownLeft, ArrowUpRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

interface Tx {
  id: string;
  tanggal: string;
  arah: string;
  nominal: number;
  jenis: string;
  keterangan: string | null;
  created_at: string;
}

const fmtIDR = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function ActivityFeed({ userId, limit = 8 }: { userId?: string; limit?: number }) {
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    let q = supabase.from("transaksi").select("id,tanggal,arah,nominal,jenis,keterangan,created_at").order("created_at", { ascending: false }).limit(limit);
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q;
    setItems((data ?? []) as Tx[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`activity-${userId ?? "all"}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "transaksi" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <Card className="border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader>
        <CardTitle className="text-base">Aktivitas Terbaru</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title="Belum ada transaksi" description="Aktivitas keuangan akan tampil di sini." />
        ) : (
          items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", t.arah === "in" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                {t.arah === "in" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize">{t.jenis.replaceAll("_", " ")}</p>
                <p className="truncate text-xs text-muted-foreground">{t.keterangan ?? new Date(t.tanggal).toLocaleDateString("id-ID")}</p>
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", t.arah === "in" ? "text-success" : "text-foreground")}>
                {t.arah === "in" ? "+" : "−"} {fmtIDR.format(Number(t.nominal))}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
