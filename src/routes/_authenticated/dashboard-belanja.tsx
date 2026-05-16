import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fmtIDR, listMyFavorites, listMyPurchases } from "@/lib/marketplace-api";
import { Button } from "@/components/ui/button";
import { Heart, Package, ShoppingBag, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-belanja")({
  component: DashboardBelanjaPage,
});

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function DashboardBelanjaPage() {
  const { user } = useAuth();
  const { data: trx = [] } = useQuery({
    queryKey: ["mp-purchases", user?.id],
    queryFn: () => (user ? listMyPurchases(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const { data: favs = [] } = useQuery({
    queryKey: ["mp-favs", user?.id],
    queryFn: () => (user ? listMyFavorites(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const total = (trx as any[]).reduce((s, t) => s + Number(t.total ?? 0), 0);
    const counts = (trx as any[]).reduce<Record<string, number>>((a, t) => {
      a[t.status] = (a[t.status] ?? 0) + 1;
      return a;
    }, {});
    return {
      total,
      orders: trx.length,
      pending: counts.pending ?? 0,
      completed: counts.completed ?? 0,
    };
  }, [trx]);

  const recent = (trx as any[]).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard Belanja</h1>
        <p className="text-sm text-muted-foreground">Ringkasan aktivitas belanja Anda di Marketplace Komunitas.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} label="Total Transaksi" value={String(stats.orders)} />
        <StatCard icon={Wallet} label="Total Belanja" value={fmtIDR(stats.total)} />
        <StatCard icon={Package} label="Menunggu / Selesai" value={`${stats.pending} / ${stats.completed}`} />
        <StatCard icon={Heart} label="Favorit Tersimpan" value={String(favs.length)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/marketplace"><Button className="rounded-full"><ShoppingBag className="mr-2 h-4 w-4" /> Belanja</Button></Link>
        <Link to="/transaksi-saya"><Button variant="outline" className="rounded-full">Lihat Semua Transaksi</Button></Link>
        <Link to="/favorit"><Button variant="outline" className="rounded-full"><Heart className="mr-2 h-4 w-4" /> Favorit</Button></Link>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 md:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Transaksi Terbaru</h2>
          <Link to="/transaksi-saya" className="text-xs font-medium text-primary hover:underline">Lihat semua</Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transaksi. Mulai belanja yuk!</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((t: any) => {
              const img = Array.isArray(t.marketplace_products?.gambar_produk) ? t.marketplace_products.gambar_produk[0] : undefined;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {img && <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{t.marketplace_products?.nama_produk ?? "Produk"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} · Qty {t.qty} · {t.status}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-primary">{fmtIDR(Number(t.total))}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
