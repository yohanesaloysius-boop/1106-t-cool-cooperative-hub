import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Coins, TrendingUp, Calendar } from "lucide-react";

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

  const total = (data ?? []).reduce((a, b) => a + Number(b.nominal), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 md:p-8 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-white/80"><Coins className="h-4 w-4" /> Sisa Hasil Usaha</div>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold">{fmt(total)}</h1>
        <p className="mt-1 text-sm text-white/80">Total SHU yang sudah diterima dari koperasi</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Riwayat SHU per Tahun</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !data?.length ? (
            <EmptyState icon={TrendingUp} title="Belum ada SHU" description="SHU akan dibagikan oleh pengurus pada akhir tahun buku." />
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
    </div>
  );
}
