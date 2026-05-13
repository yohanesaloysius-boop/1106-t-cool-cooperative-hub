import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  cicilan_ke: number;
  nominal: number;
  jatuh_tempo: string;
  status: string;
}

const fmtIDR = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function UpcomingBills({ userId }: { userId: string }) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from("angsuran").select("id,cicilan_ke,nominal,jatuh_tempo,status").eq("user_id", userId).neq("status", "paid").order("jatuh_tempo").limit(5);
      if (!mounted) return;
      setItems((data ?? []) as Row[]);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`bills-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "angsuran", filter: `user_id=eq.${userId}` }, load).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [userId]);

  return (
    <Card className="border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tagihan Jatuh Tempo</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link to="/angsuran">Semua <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Tidak ada tagihan" desc="Semua angsuran lunas. Mantap!" />
        ) : (
          items.map((a) => {
            const d = new Date(a.jatuh_tempo);
            const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const overdue = days < 0;
            const soon = days >= 0 && days <= 7;
            return (
              <Link key={a.id} to="/angsuran" className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-muted/40">
                <div className={cn("flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-semibold leading-none", overdue ? "bg-destructive/15 text-destructive" : soon ? "bg-warning/20 text-warning" : "bg-primary/10 text-primary")}>
                  <span>{d.toLocaleString("id-ID", { month: "short" }).toUpperCase()}</span>
                  <span className="text-base font-bold">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Cicilan #{a.cicilan_ke}</p>
                  <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                    {overdue ? `Lewat ${Math.abs(days)} hari` : days === 0 ? "Jatuh tempo hari ini" : `${days} hari lagi`}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{fmtIDR.format(Number(a.nominal))}</p>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
