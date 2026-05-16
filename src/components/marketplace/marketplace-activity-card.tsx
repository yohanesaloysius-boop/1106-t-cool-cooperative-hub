import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtIDR } from "@/lib/marketplace-api";
import { ArrowUpRight, Inbox, Package, ShoppingBag, Store as StoreIcon } from "lucide-react";

type Row = {
  id: string;
  role: "buyer" | "seller";
  status: string;
  qty: number;
  total: number;
  created_at: string;
  product_id: string;
  nama_produk: string;
  gambar: string | null;
  store_id: string;
  store_nama: string;
  store_slug: string;
};

const statusTone: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  confirmed: "bg-primary/15 text-primary",
  paid: "bg-primary/15 text-primary",
  shipped: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
  return `${Math.floor(diff / 86400)}h`;
}

export function MarketplaceActivityCard({ limit = 5 }: { limit?: number }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("get_user_marketplace_activity" as any, {
      _user_id: user.id,
      _limit: limit,
    });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`mp-activity-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_transactions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Card className="hover-lift rounded-3xl border-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-primary" /> Aktivitas Marketplace
          </CardTitle>
          <CardDescription>Pesanan masuk & belanja terbaru Anda</CardDescription>
        </div>
        <Link to="/dashboard-belanja">
          <Button variant="ghost" size="sm" className="rounded-full text-xs">
            Lihat semua <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada aktivitas marketplace.</p>
            <Link to="/marketplace">
              <Button size="sm" variant="outline" className="rounded-full">Mulai Belanja</Button>
            </Link>
          </div>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              to={r.role === "seller" ? "/marketplace-saya" : "/dashboard-belanja"}
              className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-border hover:bg-muted/40"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
                {r.gambar ? (
                  <img src={r.gambar} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Package className="m-auto h-5 w-5 text-muted-foreground" />
                )}
                <span
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card text-[10px] shadow ring-1 ring-border"
                  title={r.role === "seller" ? "Pesanan masuk" : "Belanja Anda"}
                >
                  {r.role === "seller" ? "🛒" : "👜"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.nama_produk}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <StoreIcon className="h-3 w-3" />
                  <span className="truncate">{r.store_nama}</span>
                  <span>·</span>
                  <span>{r.qty} pcs</span>
                  <span>·</span>
                  <span>{timeAgo(r.created_at)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{fmtIDR(Number(r.total))}</p>
                <Badge variant="secondary" className={`mt-0.5 rounded-full border-0 px-2 py-0 text-[10px] capitalize ${statusTone[r.status] ?? "bg-muted"}`}>
                  {r.status}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}