import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClipboardList, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface Item {
  id: string;
  user_id: string;
  nominal: number;
  status: string;
  created_at: string;
  tenor_bulan: number;
  profile?: { nama_lengkap: string | null; nomor_anggota: string | null } | null;
}

const fmtIDR = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const stageLabel: Record<string, string> = {
  pending_sekretaris: "Sekretaris",
  pending_bendahara: "Bendahara",
  pending_ketua: "Ketua",
};

export function ApprovalQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("pinjaman")
      .select("id,user_id,nominal,status,created_at,tenor_bulan,profile:profiles!pinjaman_user_id_fkey(nama_lengkap,nomor_anggota)")
      .in("status", ["pending_sekretaris", "pending_bendahara", "pending_ketua"])
      .order("created_at", { ascending: false })
      .limit(6);
    // Fallback if FK not present in PostgREST: do a second pass
    if (!data) {
      const { data: raw } = await supabase.from("pinjaman").select("id,user_id,nominal,status,created_at,tenor_bulan").in("status", ["pending_sekretaris", "pending_bendahara", "pending_ketua"]).order("created_at", { ascending: false }).limit(6);
      setItems((raw ?? []) as Item[]);
    } else {
      setItems(data as unknown as Item[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("approval-queue").on("postgres_changes", { event: "*", schema: "public", table: "pinjaman" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <Card className="border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Antrian Approval</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link to="/admin/pinjaman">Semua <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)
        ) : items.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Tidak ada approval" desc="Semua pengajuan sudah diproses." />
        ) : (
          items.map((p) => (
            <Link key={p.id} to="/admin/pinjaman" className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3 transition-all hover:border-primary/40 hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.profile?.nama_lengkap ?? p.user_id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">{p.profile?.nomor_anggota ?? "—"} · tenor {p.tenor_bulan} bln</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{fmtIDR.format(Number(p.nominal))}</p>
                <span className="inline-flex rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-warning">{stageLabel[p.status] ?? p.status}</span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
