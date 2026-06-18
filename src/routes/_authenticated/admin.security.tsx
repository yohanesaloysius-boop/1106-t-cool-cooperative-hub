import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, ShieldCheck, Search, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Monitoring Keamanan — T-COOL" }] }),
  component: SecurityMonitoringPage,
});

interface SecurityLog {
  id: string;
  user_id: string | null;
  event_type: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, { label: string; tone: string }> = {
  login_success: { label: "Login Berhasil", tone: "border-success/30 bg-success/10 text-success" },
  login_failed: { label: "Login Gagal", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  logout: { label: "Logout", tone: "border-border bg-muted text-muted-foreground" },
  role_change: { label: "Perubahan Role", tone: "border-primary/30 bg-primary/10 text-primary" },
  permission_change: { label: "Perubahan Izin", tone: "border-warning/30 bg-warning/10 text-warning" },
  data_delete: { label: "Hapus Data", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  transaction_edit: { label: "Edit Transaksi", tone: "border-warning/30 bg-warning/10 text-warning" },
};

function eventBadge(type: string) {
  const cfg = EVENT_LABELS[type] ?? { label: type, tone: "border-border bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[11px] ${cfg.tone}`}>{cfg.label}</Badge>;
}

function SecurityMonitoringPage() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventType, setEventType] = useState("all");
  const [userSearch, setUserSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["security-logs", dateFrom, dateTo, eventType],
    enabled: isSuperAdmin,
    queryFn: async () => {
      let q = supabase
        .from("security_logs")
        .select("id,user_id,event_type,description,ip_address,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (dateFrom) q = q.gte("created_at", new Date(dateFrom + "T00:00:00").toISOString());
      if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
      if (eventType !== "all") q = q.eq("event_type", eventType);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SecurityLog[];
    },
  });

  // Map nama pengguna
  const { data: profileMap = {} } = useQuery({
    queryKey: ["security-log-profiles", logs.map((l) => l.user_id).join(",")],
    enabled: isSuperAdmin && logs.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean))) as string[];
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("id,nama_lengkap,email").in("id", ids);
      const map: Record<string, { nama: string; email: string | null }> = {};
      (data ?? []).forEach((p: { id: string; nama_lengkap: string; email: string | null }) => {
        map[p.id] = { nama: p.nama_lengkap, email: p.email };
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const p = l.user_id ? profileMap[l.user_id] : undefined;
      return `${p?.nama ?? ""} ${p?.email ?? ""} ${l.user_id ?? ""} ${l.description ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [logs, userSearch, profileMap]);

  const reset = () => {
    setDateFrom("");
    setDateTo("");
    setEventType("all");
    setUserSearch("");
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <p className="font-semibold">Akses Ditolak</p>
          <p className="text-xs text-muted-foreground">Monitoring Keamanan hanya untuk Super Admin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-primary" />Monitoring Keamanan
        </h1>
        <p className="text-sm text-muted-foreground">
          Pantau aktivitas keamanan: login, logout, perubahan role/izin, dan perubahan data sensitif.
          Berguna untuk melacak indikasi serangan atau penyalahgunaan akun.
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Dari tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Jenis aktivitas</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {Object.entries(EVENT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cari user / deskripsi</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Nama / email / ID..." className="pl-8" />
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={reset} className="w-full">
              <RotateCcw className="mr-1 h-4 w-4" />Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada catatan keamanan sesuai filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Aktivitas</TableHead>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const p = l.user_id ? profileMap[l.user_id] : undefined;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>{eventBadge(l.event_type)}</TableCell>
                        <TableCell className="text-sm">
                          {p ? (
                            <div>
                              <p className="font-medium">{p.nama}</p>
                              <p className="text-xs text-muted-foreground">{p.email ?? "—"}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{l.user_id ?? "Sistem / anonim"}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[320px] text-xs text-muted-foreground">{l.description ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.ip_address ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        Catatan keamanan dilindungi RLS — hanya Super Admin yang dapat membacanya. Menampilkan maks. 500 entri terbaru.
      </p>
    </div>
  );
}