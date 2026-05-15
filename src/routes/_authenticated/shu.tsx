import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, TrendingUp, Calendar, Award, Users, CalendarCheck, HandCoins, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shu")({
  head: () => ({ meta: [{ title: "SHU Saya — T-COOL Koperasi" }] }),
  component: ShuPage,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function ShuPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["shu-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("shu").select("*").eq("user_id", user!.id).order("tahun", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rewards = [], isLoading: rwLoading } = useQuery({
    queryKey: ["shu-rewards-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("shu_rewards").select("*").eq("user_id", user!.id).order("tahun", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((a, b) => a + Number(b.nominal), 0);
  const totalPoin = rewards.reduce((a, b) => a + (b.total_poin ?? 0), 0);
  const totalBonus = rewards.reduce((a, b) => a + Number(b.total_bonus ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 md:p-8 text-white" style={{ background: "linear-gradient(135deg, hsl(160 84% 25%), hsl(160 70% 40%))", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-white/90"><Coins className="h-4 w-4" /> Sisa Hasil Usaha</div>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold drop-shadow-sm">{fmt(total + totalBonus)}</h1>
        <p className="mt-1 text-sm text-white/90">SHU dasar {fmt(total)} + bonus reward {fmt(totalBonus)}</p>
      </div>

      <Tabs defaultValue="shu" className="w-full">
        <TabsList>
          <TabsTrigger value="shu"><Coins className="mr-1.5 h-3.5 w-3.5" />SHU Tahunan</TabsTrigger>
          <TabsTrigger value="reward"><Award className="mr-1.5 h-3.5 w-3.5" />Reward & Poin</TabsTrigger>
        </TabsList>

        <TabsContent value="shu" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Riwayat SHU per Tahun</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !data?.length ? (
                <EmptyState icon={TrendingUp} title="Belum ada SHU" desc="SHU akan dibagikan oleh pengurus pada akhir tahun buku." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Calendar className="h-4 w-4" /></div>
                        <div>
                          <p className="font-semibold">Tahun Buku {s.tahun}</p>
                          <p className="text-xs text-muted-foreground">{s.dibagikan_at ? `Dibagikan ${new Date(s.dibagikan_at).toLocaleDateString("id-ID")}` : "Belum dibagikan"}{s.catatan ? ` · ${s.catatan}` : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-success">{fmt(Number(s.nominal))}</p>
                        <Badge variant="secondary" className="mt-1">{s.dibagikan_at ? "Diterima" : "Pending"}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reward" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Poin</p><p className="mt-1 text-2xl font-bold text-primary">{totalPoin}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Bonus SHU</p><p className="mt-1 text-2xl font-bold text-success">{fmt(totalBonus)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tahun Aktif</p><p className="mt-1 text-2xl font-bold">{rewards.length}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Cara Mendapatkan Poin</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <PoinRow icon={HandCoins} label="Setor simpanan wajib tepat waktu" poin="+10/bulan" />
              <PoinRow icon={CalendarCheck} label="Hadir rapat anggota" poin="+20/rapat" />
              <PoinRow icon={Sparkles} label="Pelunasan pinjaman tepat waktu" poin="+50" />
              <PoinRow icon={Users} label="Mengajak anggota baru aktif" poin="+100/orang" />
              <PoinRow icon={Award} label="Loyalitas anggota >2 tahun" poin="+5% dari SHU dasar" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat Reward Tahunan</CardTitle></CardHeader>
            <CardContent>
              {rwLoading ? (
                <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : rewards.length === 0 ? (
                <EmptyState icon={Award} title="Belum ada reward" desc="Aktiflah berkoperasi untuk mengumpulkan poin reward." />
              ) : (
                <ul className="divide-y divide-border">
                  {rewards.map((r) => (
                    <li key={r.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">Tahun {r.tahun}</p>
                        <p className="font-bold text-success">{fmt(Number(r.total_bonus ?? 0))}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <span>Keaktifan: <b>{r.poin_keaktifan}</b></span>
                        <span>Rapat: <b>{r.poin_kehadiran_rapat}</b></span>
                        <span>Pelunasan: <b>{r.poin_pelunasan_pinjaman}</b></span>
                        <span>Referral: <b>{r.poin_referral}</b></span>
                      </div>
                      {r.catatan && <p className="mt-1 text-xs text-muted-foreground">{r.catatan}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PoinRow({ icon: Icon, label, poin }: { icon: React.ComponentType<{ className?: string }>; label: string; poin: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span>{label}</span></div>
      <Badge variant="secondary">{poin}</Badge>
    </div>
  );
}
