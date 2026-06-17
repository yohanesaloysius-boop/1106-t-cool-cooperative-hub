import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isLeaderRoles } from "@/lib/access";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Download, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/aktivitas")({
  head: () => ({ meta: [{ title: "Audit Log Aktivitas — T-COOL" }] }),
  component: AdminActivityPage,
});

interface Row {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  tambah_anggota: "Tambah Anggota",
  edit_anggota: "Edit Anggota",
  hapus_data: "Hapus Data",
  transaksi_simpanan: "Transaksi Simpanan",
  transaksi_pinjaman: "Transaksi Pinjaman",
  perubahan_permission: "Perubahan Permission",
};

function tone(action: string) {
  if (action.includes("hapus")) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (action.includes("login") || action.includes("tambah")) return "border-success/30 bg-success/10 text-success";
  if (action.includes("edit") || action.includes("permission")) return "border-warning/30 bg-warning/10 text-warning";
  return "border-primary/30 bg-primary/10 text-primary";
}

function AdminActivityPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const canView = isLeaderRoles(roles);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState(200);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activity-logs", limit],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: names = {} } = useQuery({
    queryKey: ["activity-user-names", rows.map((r) => r.user_id).join(",")],
    enabled: canView && rows.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("id,nama_lengkap").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.nama_lengkap; });
      return map;
    },
  });

  useEffect(() => {
    if (!canView) return;
    const ch = supabase.channel("activity-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, () =>
        qc.invalidateQueries({ queryKey: ["activity-logs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canView, qc]);

  const actionTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);
  const userTypes = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => { if (r.user_id) set.set(r.user_id, names[r.user_id] ?? r.user_id); });
    return Array.from(set.entries());
  }, [rows, names]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (userFilter !== "all" && r.user_id !== userFilter) return false;
      const t = new Date(r.created_at).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (q && !`${r.action} ${r.module} ${r.description ?? ""} ${names[r.user_id ?? ""] ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, actionFilter, userFilter, dateFrom, dateTo, names]);

  const exportCsv = () => {
    const head = ["waktu", "user", "aksi", "modul", "deskripsi", "ip"].join(",");
    const body = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      `"${(names[r.user_id ?? ""] ?? r.user_id ?? "").replace(/"/g, "'")}"`,
      r.action,
      r.module,
      `"${(r.description ?? "").replace(/"/g, "'")}"`,
      r.ip_address ?? "",
    ].join(",")).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 opacity-50" />
          Hanya pimpinan (ketua / super admin) yang dapat melihat audit log.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Audit Log Aktivitas</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Ekspor CSV
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="md:col-span-1">
            <Label className="text-xs">Cari</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari deskripsi/user..." />
          </div>
          <div>
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">User</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua User</SelectItem>
                {userTypes.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Aktivitas</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Aktivitas</SelectItem>
                {actionTypes.map((a) => <SelectItem key={a} value={a}>{ACTION_LABEL[a] ?? a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Belum ada aktivitas tercatat.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Aktivitas</TableHead>
                    <TableHead>Modul</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-sm">{names[r.user_id ?? ""] ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={tone(r.action)}>{ACTION_LABEL[r.action] ?? r.action}</Badge></TableCell>
                      <TableCell className="text-sm capitalize">{r.module}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.ip_address ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length >= limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + 200)}>Muat lebih banyak</Button>
        </div>
      )}
    </div>
  );
}
