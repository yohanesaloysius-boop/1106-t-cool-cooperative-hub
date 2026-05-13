import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, CheckCircle2, XCircle, Pause, Eye, IdCard, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/anggota")({
  head: () => ({ meta: [{ title: "Kelola Anggota — T-COOL Koperasi" }] }),
  component: AnggotaPage,
});

const statusLabel: Record<string, string> = {
  pending: "Menunggu", active: "Aktif", suspended: "Ditangguhkan", rejected: "Ditolak",
};
const statusCls: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  active: "bg-success/15 text-success border-success/30",
  suspended: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function AnggotaPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nomor_anggota,nama_lengkap,email,no_hp,status,joined_at")
        .order("joined_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "rejected" }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(`Status anggota diubah ke ${statusLabel[v.status]}`);
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((m) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [m.nama_lengkap, m.email, m.nomor_anggota, m.no_hp].some((v) => v?.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kelola Anggota</h1>
          <p className="text-sm text-muted-foreground">Aktivasi, tangguhkan, atau tolak permohonan keanggotaan.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / nomor / email" className="pl-8 sm:w-72" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Anggota ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Belum ada anggota" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">No HP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.nomor_anggota ?? "—"}</TableCell>
                      <TableCell className="font-medium">{m.nama_lengkap}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{m.email ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{m.no_hp ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCls[m.status]}`}>
                          {statusLabel[m.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {m.status !== "active" && (
                            <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: m.id, status: "active" })}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          {m.status !== "suspended" && (
                            <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: m.id, status: "suspended" })}>
                              <Pause className="h-4 w-4 text-warning" />
                            </Button>
                          )}
                          {m.status !== "rejected" && (
                            <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: m.id, status: "rejected" })}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
