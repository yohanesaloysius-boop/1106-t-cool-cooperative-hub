import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtIDR } from "@/lib/marketplace-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CheckCircle2, XCircle, Eye, Package, Store as StoreIcon, ShoppingBag,
  TrendingUp, Search, Ban, Trash2, ExternalLink, Sparkles, Crown,
  Flame, ShieldCheck, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({
  head: () => ({ meta: [{ title: "Manajemen Marketplace — Admin T-COOL" }] }),
  component: AdminMarketplacePage,
});

// ---------- data hook ----------
function useMarketplaceData() {
  return useQuery({
    queryKey: ["admin-marketplace-all"],
    queryFn: async () => {
      const [stores, products, cats, trx] = await Promise.all([
        supabase.from("marketplace_stores").select("*, profiles(nama_lengkap)").order("created_at", { ascending: false }),
        supabase.from("marketplace_products").select("*, marketplace_categories(slug,nama_kategori), marketplace_stores(slug,nama_toko)").order("created_at", { ascending: false }),
        supabase.from("marketplace_categories").select("*"),
        supabase.from("marketplace_transactions").select("*, marketplace_products(nama_produk), marketplace_stores(nama_toko)").order("created_at", { ascending: false }).limit(500),
      ]);
      if (stores.error) throw stores.error;
      if (products.error) throw products.error;
      if (cats.error) throw cats.error;
      if (trx.error) throw trx.error;
      return {
        stores: (stores.data ?? []) as any[],
        products: (products.data ?? []) as any[],
        categories: (cats.data ?? []) as any[],
        transactions: (trx.data ?? []) as any[],
      };
    },
  });
}

// ---------- page ----------
function AdminMarketplacePage() {
  const { data, isLoading, refetch, isFetching } = useMarketplaceData();

  const stats = useMemo(() => {
    const stores = data?.stores ?? [];
    const products = data?.products ?? [];
    const trx = data?.transactions ?? [];
    const completedTrx = trx.filter((t) => ["completed", "paid", "shipped", "confirmed"].includes(t.status));
    const gmv = completedTrx.reduce((s, t) => s + Number(t.total ?? 0), 0);
    return {
      totalStores: stores.length,
      activeStores: stores.filter((s) => s.status_toko === "active").length,
      pendingStores: stores.filter((s) => s.status_toko === "inactive").length,
      suspendedStores: stores.filter((s) => s.status_toko === "suspended").length,
      totalProducts: products.length,
      draftProducts: products.filter((p) => p.status_produk === "draft").length,
      activeProducts: products.filter((p) => p.status_produk === "active").length,
      totalTrx: trx.length,
      gmv,
      pendingTrx: trx.filter((t) => t.status === "pending").length,
    };
  }, [data]);

  // --- 30 hari chart series ---
  const trxSeries = useMemo(() => {
    const days: { d: string; label: string; trx: number; gmv: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const k = dt.toISOString().slice(0, 10);
      days.push({ d: k, label: dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), trx: 0, gmv: 0 });
    }
    const map = new Map(days.map((x) => [x.d, x]));
    (data?.transactions ?? []).forEach((t) => {
      const k = String(t.created_at).slice(0, 10);
      const row = map.get(k);
      if (row) {
        row.trx += 1;
        row.gmv += Number(t.total ?? 0);
      }
    });
    return days;
  }, [data]);

  // --- top kategori bar ---
  const catSeries = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.products ?? []).forEach((p) => {
      const name = p.marketplace_categories?.nama_kategori ?? "Lainnya";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 6);
  }, [data]);

  // --- top toko & produk populer ---
  const topStores = useMemo(() => {
    const map = new Map<string, { id: string; nama: string; gmv: number; trx: number }>();
    (data?.transactions ?? []).forEach((t) => {
      const id = t.store_id;
      const nama = t.marketplace_stores?.nama_toko ?? "—";
      const row = map.get(id) ?? { id, nama, gmv: 0, trx: 0 };
      row.gmv += Number(t.total ?? 0);
      row.trx += 1;
      map.set(id, row);
    });
    return Array.from(map.values()).sort((a, b) => b.gmv - a.gmv).slice(0, 5);
  }, [data]);

  const popularProducts = useMemo(() => {
    return [...(data?.products ?? [])].sort((a, b) => Number(b.view_count ?? 0) - Number(a.view_count ?? 0)).slice(0, 5);
  }, [data]);

  const statusDist = useMemo(() => {
    const trx = data?.transactions ?? [];
    const c: Record<string, number> = {};
    trx.forEach((t) => { c[t.status] = (c[t.status] ?? 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> Admin Marketplace
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold">Manajemen Marketplace</h1>
            <p className="mt-1 text-sm text-white/80">Approve toko & produk, moderasi konten, dan pantau performa marketplace komunitas.</p>
          </div>
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="GMV (Selesai)" value={fmtIDR(stats.gmv)} icon={TrendingUp} tint="from-emerald-400 to-emerald-600" hint={`${stats.totalTrx} transaksi total`} loading={isLoading} />
        <StatTile label="Total Toko" value={stats.totalStores.toLocaleString("id-ID")} icon={StoreIcon} tint="from-sky-400 to-blue-600" hint={`${stats.activeStores} aktif · ${stats.pendingStores} menunggu`} loading={isLoading} />
        <StatTile label="Total Produk" value={stats.totalProducts.toLocaleString("id-ID")} icon={Package} tint="from-violet-400 to-purple-600" hint={`${stats.draftProducts} draft perlu approve`} loading={isLoading} />
        <StatTile label="Transaksi Pending" value={stats.pendingTrx.toLocaleString("id-ID")} icon={ShoppingBag} tint="from-amber-400 to-orange-600" hint="Perlu pantauan" loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 lg:col-span-2" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Transaksi & GMV — 30 Hari</p>
              <p className="text-xs text-muted-foreground">Tren harian marketplace</p>
            </div>
            <Badge variant="secondary" className="rounded-full">Realtime</Badge>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={trxSeries}>
                <defs>
                  <linearGradient id="gGmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}rb` : String(v))} />
                <Tooltip formatter={(v: any, n) => (n === "gmv" ? fmtIDR(Number(v)) : v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="gmv" stroke="hsl(var(--primary))" fill="url(#gGmv)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold">Produk per Kategori</p>
          <p className="mb-2 text-xs text-muted-foreground">Distribusi katalog aktif</p>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={catSeries} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="nama" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="jumlah" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Toko & Produk Populer */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard icon={Crown} title="Toko Terlaris" subtitle="Berdasarkan GMV semua waktu">
          {topStores.length === 0 ? (
            <Empty text="Belum ada transaksi." />
          ) : topStores.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-3 py-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-foreground"}`}>#{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.nama}</p>
                <p className="text-xs text-muted-foreground">{s.trx} transaksi</p>
              </div>
              <p className="text-sm font-bold tabular-nums text-primary">{fmtIDR(s.gmv)}</p>
            </div>
          ))}
        </PanelCard>

        <PanelCard icon={Flame} title="Produk Populer" subtitle="Berdasarkan jumlah view">
          {popularProducts.length === 0 ? (
            <Empty text="Belum ada produk." />
          ) : popularProducts.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-3 py-2.5">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.gambar_produk?.[0] && <img src={p.gambar_produk[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.nama_produk}</p>
                <p className="text-xs text-muted-foreground">{p.marketplace_stores?.nama_toko ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">{Number(p.view_count ?? 0).toLocaleString("id-ID")}</p>
                <p className="text-[11px] text-muted-foreground">views</p>
              </div>
            </div>
          ))}
        </PanelCard>
      </div>

      {/* Tabs management */}
      <div className="rounded-3xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <Tabs defaultValue="moderasi">
          <TabsList className="rounded-full">
            <TabsTrigger value="moderasi" className="rounded-full"><Sparkles className="mr-1 h-3.5 w-3.5" /> Moderasi</TabsTrigger>
            <TabsTrigger value="toko" className="rounded-full">Toko</TabsTrigger>
            <TabsTrigger value="produk" className="rounded-full">Produk</TabsTrigger>
            <TabsTrigger value="transaksi" className="rounded-full">Transaksi</TabsTrigger>
          </TabsList>

          <TabsContent value="moderasi" className="mt-5 space-y-6">
            <ModerationPanel data={data} loading={isLoading} onChanged={() => refetch()} />
          </TabsContent>
          <TabsContent value="toko" className="mt-5">
            <StoresTable rows={data?.stores ?? []} onChanged={() => refetch()} />
          </TabsContent>
          <TabsContent value="produk" className="mt-5">
            <ProductsTable rows={data?.products ?? []} categories={data?.categories ?? []} onChanged={() => refetch()} />
          </TabsContent>
          <TabsContent value="transaksi" className="mt-5">
            <TransactionsTable rows={data?.transactions ?? []} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Distribusi status transaksi */}
      {statusDist.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold">Distribusi Status Transaksi</p>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- subcomponents ----------
function StatTile({ label, value, icon: Icon, tint, hint, loading }: { label: string; value: string; icon: any; tint: string; hint?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tabular-nums">{loading ? "…" : value}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function PanelCard({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{text}</p>;
}

// ---------- Moderation ----------
function ModerationPanel({ data, loading, onChanged }: { data: any; loading: boolean; onChanged: () => void }) {
  const pendingStores = (data?.stores ?? []).filter((s: any) => s.status_toko === "inactive");
  const pendingProducts = (data?.products ?? []).filter((p: any) => p.status_produk === "draft");

  const approveStore = async (id: string) => {
    const { error } = await supabase.from("marketplace_stores").update({ status_toko: "active" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Toko diaktifkan."); onChanged();
  };
  const rejectStore = async (id: string) => {
    const { error } = await supabase.from("marketplace_stores").update({ status_toko: "suspended" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Toko ditolak."); onChanged();
  };
  const approveProduct = async (id: string) => {
    const { error } = await supabase.from("marketplace_products").update({ status_produk: "active" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produk dipublikasikan."); onChanged();
  };
  const rejectProduct = async (id: string) => {
    const { error } = await supabase.from("marketplace_products").update({ status_produk: "archived" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produk diarsipkan."); onChanged();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PanelCard icon={StoreIcon} title="Toko Menunggu Approval" subtitle={`${pendingStores.length} toko`}>
        {loading ? <Empty text="Memuat…" /> : pendingStores.length === 0 ? <Empty text="Tidak ada toko menunggu." /> : pendingStores.map((s: any) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
              {s.logo && <img src={s.logo} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.nama_toko}</p>
              <p className="truncate text-xs text-muted-foreground">{s.profiles?.nama_lengkap ?? "—"}</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 rounded-full text-destructive" onClick={() => rejectStore(s.id)}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Tolak
            </Button>
            <Button size="sm" className="h-8 rounded-full" onClick={() => approveStore(s.id)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
            </Button>
          </div>
        ))}
      </PanelCard>

      <PanelCard icon={Package} title="Produk Menunggu Approval" subtitle={`${pendingProducts.length} produk draft`}>
        {loading ? <Empty text="Memuat…" /> : pendingProducts.length === 0 ? <Empty text="Tidak ada produk draft." /> : pendingProducts.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
              {p.gambar_produk?.[0] && <img src={p.gambar_produk[0]} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.nama_produk}</p>
              <p className="truncate text-xs text-muted-foreground">{p.marketplace_stores?.nama_toko} · {fmtIDR(Number(p.harga))}</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 rounded-full text-destructive" onClick={() => rejectProduct(p.id)}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Arsip
            </Button>
            <Button size="sm" className="h-8 rounded-full" onClick={() => approveProduct(p.id)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
            </Button>
          </div>
        ))}
      </PanelCard>
    </div>
  );
}

// ---------- Stores Table ----------
function StoresTable({ rows, onChanged }: { rows: any[]; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchQ = !q || r.nama_toko?.toLowerCase().includes(q.toLowerCase()) || r.profiles?.nama_lengkap?.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || r.status_toko === status;
      return matchQ && matchS;
    });
  }, [rows, q, status]);

  const setStoreStatus = async (id: string, newStatus: "active" | "inactive" | "suspended") => {
    const { error } = await supabase.from("marketplace_stores").update({ status_toko: newStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status toko diperbarui."); onChanged();
  };

  return (
    <div className="space-y-3">
      <Filters q={q} setQ={setQ} status={status} setStatus={setStatus} options={[
        { value: "all", label: "Semua status" },
        { value: "active", label: "Aktif" },
        { value: "inactive", label: "Menunggu" },
        { value: "suspended", label: "Diblokir" },
      ]} placeholder="Cari nama toko / pemilik…" />

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Toko</th>
              <th className="px-3 py-2.5 hidden md:table-cell">Pemilik</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">Tidak ada data.</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-border/60">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 overflow-hidden rounded-lg bg-muted">
                      {s.logo && <img src={s.logo} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{s.nama_toko}</p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">/{s.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{s.profiles?.nama_lengkap ?? "—"}</td>
                <td className="px-3 py-2.5"><StoreStatusBadge status={s.status_toko} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <Link to="/marketplace/toko/$slug" params={{ slug: s.slug }}>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    </Link>
                    {s.status_toko !== "active" && (
                      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setStoreStatus(s.id, "active")}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aktifkan
                      </Button>
                    )}
                    {s.status_toko !== "suspended" && (
                      <Button size="sm" variant="outline" className="h-8 rounded-full text-destructive" onClick={() => setStoreStatus(s.id, "suspended")}>
                        <Ban className="mr-1 h-3.5 w-3.5" /> Blokir
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoreStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Aktif", cls: "bg-emerald-100 text-emerald-700" },
    inactive: { label: "Menunggu", cls: "bg-amber-100 text-amber-700" },
    suspended: { label: "Diblokir", cls: "bg-rose-100 text-rose-700" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-foreground" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.cls}`}>{v.label}</span>;
}

// ---------- Products Table ----------
function ProductsTable({ rows, categories, onChanged }: { rows: any[]; categories: any[]; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchQ = !q || r.nama_produk?.toLowerCase().includes(q.toLowerCase()) || r.marketplace_stores?.nama_toko?.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || r.status_produk === status;
      const matchC = cat === "all" || r.marketplace_categories?.slug === cat;
      return matchQ && matchS && matchC;
    });
  }, [rows, q, status, cat]);

  const setProductStatus = async (id: string, newStatus: "active" | "draft" | "archived" | "out_of_stock") => {
    const { error } = await supabase.from("marketplace_products").update({ status_produk: newStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status produk diperbarui."); onChanged();
  };
  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("marketplace_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produk dihapus."); onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk / toko…" className="rounded-full pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-full rounded-full md:w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.nama_kategori}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full rounded-full md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="out_of_stock">Habis</SelectItem>
            <SelectItem value="archived">Diarsipkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5 hidden md:table-cell">Toko</th>
              <th className="px-3 py-2.5 hidden lg:table-cell">Kategori</th>
              <th className="px-3 py-2.5 text-right">Harga</th>
              <th className="px-3 py-2.5 text-right hidden sm:table-cell">Stok</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">Tidak ada data.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-muted">
                      {p.gambar_produk?.[0] && <img src={p.gambar_produk[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{p.nama_produk}</p>
                      <p className="text-[11px] text-muted-foreground">{Number(p.view_count ?? 0)} views</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{p.marketplace_stores?.nama_toko ?? "—"}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell"><Badge variant="secondary" className="rounded-full">{p.marketplace_categories?.nama_kategori ?? "—"}</Badge></td>
                <td className="px-3 py-2.5 text-right font-semibold text-primary tabular-nums">{fmtIDR(Number(p.harga))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">{p.stok}</td>
                <td className="px-3 py-2.5"><ProductStatusBadge status={p.status_produk} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1.5">
                    <Link to="/marketplace/produk/$id" params={{ id: p.id }}>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                    </Link>
                    {p.status_produk !== "active" && (
                      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setProductStatus(p.id, "active")}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {p.status_produk !== "archived" && (
                      <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setProductStatus(p.id, "archived")}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus produk?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{p.nama_produk}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeProduct(p.id)}>Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Aktif", cls: "bg-emerald-100 text-emerald-700" },
    draft: { label: "Draft", cls: "bg-amber-100 text-amber-700" },
    out_of_stock: { label: "Habis", cls: "bg-slate-100 text-slate-700" },
    archived: { label: "Arsip", cls: "bg-rose-100 text-rose-700" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-foreground" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.cls}`}>{v.label}</span>;
}

// ---------- Transactions Table ----------
function TransactionsTable({ rows }: { rows: any[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchQ = !q || r.marketplace_products?.nama_produk?.toLowerCase().includes(q.toLowerCase()) || r.marketplace_stores?.nama_toko?.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "all" || r.status === status;
      return matchQ && matchS;
    });
  }, [rows, q, status]);

  return (
    <div className="space-y-3">
      <Filters q={q} setQ={setQ} status={status} setStatus={setStatus} options={[
        { value: "all", label: "Semua status" },
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Dikonfirmasi" },
        { value: "paid", label: "Dibayar" },
        { value: "shipped", label: "Dikirim" },
        { value: "completed", label: "Selesai" },
        { value: "cancelled", label: "Dibatalkan" },
      ]} placeholder="Cari produk / toko…" />

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Tanggal</th>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5 hidden md:table-cell">Toko</th>
              <th className="px-3 py-2.5 text-right">Qty</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">Belum ada transaksi.</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-border/60">
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td className="px-3 py-2.5 font-medium">{t.marketplace_products?.nama_produk ?? "—"}</td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{t.marketplace_stores?.nama_toko ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{t.qty}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-primary tabular-nums">{fmtIDR(Number(t.total))}</td>
                <td className="px-3 py-2.5"><TrxStatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrxStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-sky-100 text-sky-700",
    paid: "bg-blue-100 text-blue-700",
    shipped: "bg-violet-100 text-violet-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-muted text-foreground"}`}>{status}</span>;
}

function Filters({ q, setQ, status, setStatus, options, placeholder }: { q: string; setQ: (v: string) => void; status: string; setStatus: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="rounded-full pl-9" />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full rounded-full md:w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
