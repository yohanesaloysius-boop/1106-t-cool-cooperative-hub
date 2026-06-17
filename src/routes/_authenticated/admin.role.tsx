import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, ShieldAlert, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/role")({
  head: () => ({ meta: [{ title: "Kelola Role — T-COOL" }] }),
  component: AdminRolePage,
});

const ALL_ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "super_admin", label: "Super Admin", desc: "Akses penuh termasuk kelola role" },
  { value: "ketua", label: "Ketua (Admin)", desc: "Pimpinan — akses penuh data & pengaturan" },
  { value: "sekretaris", label: "Sekretaris (Pengurus)", desc: "Administrasi & keanggotaan" },
  { value: "bendahara", label: "Bendahara", desc: "Transaksi & laporan keuangan" },
  { value: "anggota", label: "Anggota", desc: "Hanya melihat data sendiri" },
];

const roleTone: Record<AppRole, string> = {
  super_admin: "border-destructive/30 bg-destructive/10 text-destructive",
  ketua: "border-primary/30 bg-primary/10 text-primary",
  sekretaris: "border-warning/30 bg-warning/10 text-warning",
  bendahara: "border-success/30 bg-success/10 text-success",
  anggota: "border-border bg-muted text-muted-foreground",
};

interface MemberRow {
  id: string;
  nama_lengkap: string;
  email: string | null;
  nomor_anggota: string | null;
  foto_url: string | null;
  roles: AppRole[];
}

function AdminRolePage() {
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = roles.includes("super_admin");
  const [search, setSearch] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["role-members"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: ur, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id,nama_lengkap,email,nomor_anggota,foto_url").order("nama_lengkap"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const byUser = new Map<string, AppRole[]>();
      (ur ?? []).forEach((r: { user_id: string; role: AppRole }) => {
        const list = byUser.get(r.user_id) ?? [];
        list.push(r.role);
        byUser.set(r.user_id, list);
      });
      return (profiles ?? []).map((p): MemberRow => ({
        id: p.id,
        nama_lengkap: p.nama_lengkap,
        email: p.email,
        nomor_anggota: p.nomor_anggota,
        foto_url: p.foto_url,
        roles: byUser.get(p.id) ?? [],
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      `${m.nama_lengkap} ${m.email ?? ""} ${m.nomor_anggota ?? ""}`.toLowerCase().includes(q),
    );
  }, [members, search]);

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <p className="font-semibold">Akses Ditolak</p>
          <p className="text-xs text-muted-foreground">Halaman Kelola Role hanya untuk Super Admin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserCog className="h-6 w-6 text-primary" />Kelola Role
        </h1>
        <p className="text-sm text-muted-foreground">
          Tetapkan atau cabut hak akses (role) anggota. Perubahan diproses & divalidasi di server.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Label className="text-xs">Cari anggota</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama / email / no. anggota..." className="pl-8" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada anggota sesuai pencarian.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Role saat ini</TableHead>
                    <TableHead className="text-right w-[120px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.foto_url ?? undefined} />
                            <AvatarFallback>{m.nama_lengkap.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{m.nama_lengkap}</p>
                            <p className="text-xs text-muted-foreground">{m.email ?? m.nomor_anggota ?? "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            m.roles.map((r) => (
                              <Badge key={r} variant="outline" className={`text-[11px] ${roleTone[r]}`}>{r}</Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <ManageDialog
                          member={m}
                          selfId={user?.id ?? null}
                          onChanged={() => qc.invalidateQueries({ queryKey: ["role-members"] })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        Role disimpan terpisah di tabel user_roles & dilindungi RLS. Super admin terakhir tidak dapat dicabut.
      </p>
    </div>
  );
}

function ManageDialog({ member, selfId, onChanged }: { member: MemberRow; selfId: string | null; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<AppRole | null>(null);

  const toggle = async (role: AppRole, enable: boolean) => {
    setBusy(role);
    try {
      const { error } = await (supabase.rpc as any)("admin_set_role", {
        target_user: member.id,
        target_role: role,
        enable,
      });
      if (error) throw error;
      toast.success(`Role ${role} ${enable ? "ditambahkan" : "dicabut"} untuk ${member.nama_lengkap}`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal mengubah role");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserCog className="mr-1 h-4 w-4" />Kelola</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kelola Role — {member.nama_lengkap}</DialogTitle>
          <DialogDescription>Aktifkan untuk memberi hak akses, nonaktifkan untuk mencabut.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {ALL_ROLES.map((r) => {
            const has = member.roles.includes(r.value);
            const isSelfSuper = selfId === member.id && r.value === "super_admin";
            return (
              <div key={r.value} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
                {busy === r.value ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={has}
                    disabled={isSelfSuper && has}
                    onCheckedChange={(v) => toggle(r.value, v)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
