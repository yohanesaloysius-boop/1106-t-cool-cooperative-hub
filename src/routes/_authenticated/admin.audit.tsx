import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, Download, Eye, Loader2, Search, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — T-COOL" }] }),
  component: AdminAuditPage,
});

interface Row {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  new_data: unknown;
  old_data: unknown;
  created_at: string;
}

function deviceFromUA(ua: string | null) {
  if (!ua) return "—";
  const u = ua.toLowerCase();
  if (u.includes("iphone") || u.includes("ipad")) return "iOS";
  if (u.includes("android")) return "Android";
  if (u.includes("windows")) return "Windows";
  if (u.includes("mac os") || u.includes("macintosh")) return "macOS";
  if (u.includes("linux")) return "Linux";
  return "Web";
}

function actionTone(action: string) {
  if (action.includes("rejected") || action.includes("delete") || action.includes("error")) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (action.includes("approved") || action.includes("created") || action.includes("login")) return "border-success/30 bg-success/10 text-success";
  if (action.includes("update") || action.includes("edit")) return "border-warning/30 bg-warning/10 text-warning";
  return "border-primary/30 bg-primary/10 text-primary";
}

function AdminAuditPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [limit, setLimit] = useState(100);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-logs", limit],
    enabled: isPengurus,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // realtime: prepend new logs
  useEffect(() => {
    if (!isPengurus) return;
    const ch = supabase.channel("audit-rt-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, () => qc.invalidateQueries({ queryKey: ["audit-logs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isPengurus, qc]);

  // unique action prefixes for filter
  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.action.split(".")[0]));
    return Array.from(set).sort();
  }, [rows]);

  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.entity));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== "all" && !r.action.startsWith(actionFilter)) return false;
      if (entityFilter !== "all" && r.entity !== entityFilter) return false;
      if (q && !`${r.action} ${r.entity} ${r.actor_id ?? ""} ${r.entity_id ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, actionFilter, entityFilter]);

  const exportCsv = () => {
    const head = ["timestamp", "user_id", "role", "action", "entity", "entity_id", "ip", "device", "user_agent"].join(",");
    const body = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.actor_id ?? "",
      r.actor_role ?? "",
      r.action,
      r.entity,
      r.entity_id ?? "",
      r.ip_address ?? "",
      deviceFromUA(r.user_agent),
      `"${(r.user_agent ?? "").replace(/"/g, "'")}"`,
    ].join(",")).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!isPengurus) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Hanya pengurus yang dapat mengakses audit log.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="h-6 w-6 text-primary" />Audit Log</h1>
          <p className="text-sm text-muted-foreground">Jejak aktivitas: login, edit data, approval, delete, dan generate laporan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div>
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Action / entity / id..." className="pl-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Jenis Aktivitas</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {actionTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Entity</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {entityTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Limit</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[50, 100, 250, 500, 1000].map((n) => <SelectItem key={n} value={String(n)}>{n} terbaru</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada log sesuai filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Waktu</TableHead>
                    <TableHead>Aktivitas</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>IP / Device</TableHead>
                    <TableHead className="text-right w-[80px]">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</TableCell>
                      <TableCell><Badge variant="outline" className={`font-mono text-[11px] ${actionTone(r.action)}`}>{r.action}</Badge></TableCell>
                      <TableCell>
                        <span className="text-xs">{r.entity}</span>
                        {r.entity_id && <p className="font-mono text-[10px] text-muted-foreground">#{r.entity_id.slice(0, 8)}</p>}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{r.actor_id ? r.actor_id.slice(0, 8) : "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{r.actor_role ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.ip_address ?? "—"}</div>
                        <div className="text-muted-foreground">{deviceFromUA(r.user_agent)}</div>
                      </TableCell>
                      <TableCell className="text-right"><DetailButton row={r} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Activity className="h-3 w-3" />Streaming realtime via Supabase channels.</p>
    </div>
  );
}

function DetailButton({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Detail Log</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Action" value={row.action} mono />
            <Field label="Entity" value={row.entity} />
            <Field label="Entity ID" value={row.entity_id ?? "—"} mono />
            <Field label="Actor" value={row.actor_id ?? "—"} mono />
            <Field label="Role" value={row.actor_role ?? "—"} />
            <Field label="Waktu" value={new Date(row.created_at).toLocaleString("id-ID")} />
            <Field label="IP" value={row.ip_address ?? "—"} />
            <Field label="Device" value={deviceFromUA(row.user_agent)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">User Agent</p>
            <p className="break-all rounded bg-muted p-2 text-[11px]">{row.user_agent ?? "—"}</p>
          </div>
          {row.new_data != null && (
            <div>
              <p className="text-xs text-muted-foreground">New Data</p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(row.new_data, null, 2)}</pre>
            </div>
          )}
          {row.old_data != null && (
            <div>
              <p className="text-xs text-muted-foreground">Old Data</p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(row.old_data, null, 2)}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</p>
    </div>
  );
}