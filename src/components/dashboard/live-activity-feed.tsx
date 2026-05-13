import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, LogIn, Pencil, Trash2, FileSignature, FileText, ShieldCheck, Loader2 } from "lucide-react";

interface Row {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string;
  user_agent: string | null;
  new_data: Record<string, unknown> | null;
}

function iconFor(action: string) {
  if (action.startsWith("auth.")) return LogIn;
  if (action.includes("approval") || action.includes("approved") || action.includes("signed")) return FileSignature;
  if (action.includes("delete")) return Trash2;
  if (action.includes("report") || action.includes("export") || action.includes("laporan")) return FileText;
  if (action.includes("update") || action.includes("edit")) return Pencil;
  return ShieldCheck;
}

function colorFor(action: string) {
  if (action.includes("rejected") || action.includes("delete")) return "bg-destructive/15 text-destructive";
  if (action.includes("approved") || action.includes("login") || action.includes("created")) return "bg-success/15 text-success";
  if (action.includes("update") || action.includes("edit")) return "bg-warning/15 text-warning";
  return "bg-primary/15 text-primary";
}

export function LiveActivityFeed({ limit = 10, title = "Live Activity" }: { limit?: number; title?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("audit_logs").select("id,action,entity,entity_id,actor_id,created_at,user_agent,new_data").order("created_at", { ascending: false }).limit(limit);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    };
    load();
    const ch = supabase.channel("audit-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (payload) => {
        setRows((prev) => [payload.new as Row, ...prev].slice(0, limit));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [limit]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />{title}
          <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-success" />Live</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
          : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const Icon = iconFor(r.action);
                return (
                  <li key={r.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorFor(r.action)}`}><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="text-xs font-semibold">{r.action}</code>
                        <Badge variant="outline" className="text-[10px]">{r.entity}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("id-ID")}
                        {r.entity_id && <span className="ml-2 font-mono">#{r.entity_id.slice(0, 8)}</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </CardContent>
    </Card>
  );
}