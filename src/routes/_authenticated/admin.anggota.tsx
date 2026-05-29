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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, CheckCircle2, XCircle, Pause, Eye, IdCard, FileText, Printer, Upload, Trash2, ShieldCheck, MessageCircle, Send, Church, GraduationCap, RefreshCw } from "lucide-react";
import { MemberCardPrint } from "@/components/member-card-print";
import { useServerFn } from "@tanstack/react-start";
import { importMembersCsv, deleteDemoMembers } from "@/lib/admin-members.functions";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhone, openWhatsApp, waUrl, WA_TEMPLATES } from "@/lib/whatsapp";

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
  const { user, roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [roleMember, setRoleMember] = useState<{ id: string; nama_lengkap: string } | null>(null);
  
  const [printMember, setPrintMember] = useState<{ id: string; nama_lengkap: string; nomor_anggota: string | null; foto_url: string | null; joined_at?: string | null } | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nomor_anggota,nama_lengkap,email,no_hp,status,joined_at,foto_url")
        .order("joined_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const refreshMembers = () => {
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      void refetch();
    };
    const ch = supabase.channel(`admin-members-rt-${user?.id ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshMembers)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: user?.id ? `user_id=eq.${user.id}` : undefined },
        (payload) => {
          if ((payload.new as { kategori?: string; ref_table?: string })?.kategori === "approval") refreshMembers();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, refetch, user?.id]);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "rejected" }) => {
      if (status === "active") {
        // RPC: aktivasi + buat dompet + tagihan simpanan pokok + notifikasi
        const { error } = await (supabase.rpc as any)("approve_member", { p_user_id: id });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
      await Promise.all([
        supabase.from("audit_logs").insert({
          actor_id: user?.id, entity: "profiles", entity_id: id,
          action: `member_${status}`, new_data: { status },
        }),
        supabase.from("notifications").insert({
          user_id: id,
          judul: status === "suspended" ? "Akun ditangguhkan" : "Pendaftaran ditolak",
          pesan: status === "suspended"
            ? "Akun Anda ditangguhkan oleh pengurus. Silakan hubungi sekretaris."
            : "Pendaftaran Anda ditolak. Hubungi pengurus untuk informasi lanjut.",
          kategori: status === "suspended" ? "peringatan" : "error",
          ref_table: "profiles", ref_id: id,
        }),
      ]);
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "active"
        ? "Anggota diaktifkan — dompet & tagihan simpanan pokok dibuat otomatis."
        : `Status anggota diubah ke ${statusLabel[v.status]}`);
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void refetch();
              qc.invalidateQueries({ queryKey: ["admin-members"] });
              toast.success("Daftar anggota diperbarui");
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => setBroadcastOpen(true)}>
            <Send className="h-3.5 w-3.5" /> Broadcast WA
          </Button>
          <ImportCsvButton />
          <DeleteDemoButton />

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / nomor / email" className="pl-8 sm:w-72" />
          </div>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!normalizePhone(m.no_hp)}
                            onClick={() => openWhatsApp(m.no_hp, `Halo ${m.nama_lengkap}, salam dari pengurus Koperasi T-COOL 🌿`)}
                            title={normalizePhone(m.no_hp) ? "Chat WhatsApp" : "Nomor HP belum diisi"}
                          >
                            <MessageCircle className="h-4 w-4 text-success" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDetailId(m.id)} title="Detail">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPrintMember({ id: m.id, nama_lengkap: m.nama_lengkap, nomor_anggota: m.nomor_anggota, foto_url: m.foto_url, joined_at: m.joined_at })} title="Cetak Kartu Anggota">
                            <Printer className="h-4 w-4 text-primary" />
                          </Button>
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
                          {isSuperAdmin && (
                            <Button size="sm" variant="ghost" onClick={() => setRoleMember({ id: m.id, nama_lengkap: m.nama_lengkap })} title="Jadikan Pengurus / Wewenang">
                              <ShieldCheck className="h-4 w-4 text-primary" />
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

      <MemberDetailDialog id={detailId} onClose={() => setDetailId(null)} />
      <MemberCardPrint open={!!printMember} onClose={() => setPrintMember(null)} member={printMember} />
      <AssignRoleDialog member={roleMember} onClose={() => setRoleMember(null)} />
      
      <BroadcastWaDialog open={broadcastOpen} onClose={() => setBroadcastOpen(false)} members={data ?? []} />
    </div>
  );
}

const ROLE_OPTIONS: { value: "ketua" | "sekretaris" | "bendahara"; label: string; desc: string }[] = [
  { value: "ketua", label: "Ketua", desc: "Memimpin koperasi, menyetujui keputusan strategis & approval final." },
  { value: "sekretaris", label: "Sekretaris", desc: "Mengelola administrasi, notulensi rapat & verifikasi anggota." },
  { value: "bendahara", label: "Bendahara", desc: "Mengelola keuangan, verifikasi simpanan/pinjaman & laporan kas." },
];

function AssignRoleDialog({ member, onClose }: { member: { id: string; nama_lengkap: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const { data: currentRoles, refetch } = useQuery({
    queryKey: ["member-roles", member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", member!.id).is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const toggleRole = async (role: "ketua" | "sekretaris" | "bendahara", assign: boolean) => {
    if (!member) return;
    setBusy(true);
    try {
      if (assign) {
        const { error } = await supabase.from("user_roles").upsert(
          { user_id: member.id, role, deleted_at: null, created_by: user?.id },
          { onConflict: "user_id,role" },
        );
        if (error) throw error;
        await supabase.from("notifications").insert({
          user_id: member.id,
          judul: `🎖️ Anda diangkat sebagai ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          pesan: `Selamat! Super Admin telah mengangkat Anda sebagai ${role} koperasi T-COOL.`,
          kategori: "sukses",
          url: "/admin",
          ref_table: "user_roles",
          ref_id: member.id,
        });
        toast.success(`${member.nama_lengkap} diangkat sebagai ${role}`);
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", member.id).eq("role", role);
        if (error) throw error;
        toast.success(`Jabatan ${role} dicabut`);
      }
      await supabase.from("audit_logs").insert({
        actor_id: user?.id, entity: "user_roles", entity_id: member.id,
        action: assign ? `assign_${role}` : `revoke_${role}`, new_data: { role },
      });
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Jadikan Pengurus / Wewenang</DialogTitle>
          <DialogDescription>Aktifkan atau cabut jabatan pengurus dan wewenang pengadaan untuk anggota ini.</DialogDescription>
        </DialogHeader>
        {member && (
          <div className="space-y-4 overflow-y-auto pr-1 -mr-1 flex-1">
            <p className="text-sm">Pilih jabatan untuk <span className="font-semibold">{member.nama_lengkap}</span>. Jabatan dapat diaktifkan/dicabut kapan saja.</p>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jabatan Pengurus Koperasi</p>
              {ROLE_OPTIONS.map((opt) => {
                const has = currentRoles?.includes(opt.value);
                return (
                  <div key={opt.value} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{opt.label}{has && <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Aktif</span>}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    <Button size="sm" variant={has ? "outline" : "default"} disabled={busy} onClick={() => toggleRole(opt.value, !has)}>
                      {has ? "Cabut" : "Angkat"}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wewenang Pengadaan / Belanja</p>
              <p className="text-[11px] text-muted-foreground">Gereja dan sekolah adalah unit kerja terpisah — wewenang juga terpisah. Scroll ke bawah untuk mengatur wewenang sekolah.</p>
              <ChurchRequesterSection member={member} />
              <SchoolRequesterSection member={member} />
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChurchRequesterSection({ member }: { member: { id: string; nama_lengkap: string } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [jabatan, setJabatan] = useState("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: current, refetch } = useQuery({
    queryKey: ["church-requester", member.id],
    queryFn: async () => {
      const { data } = await supabase.from("church_requesters" as any)
        .select("*").eq("user_id", member.id).maybeSingle();
      return data as any;
    },
  });

  const { data: divisions } = useQuery({
    queryKey: ["church-divisions-all"],
    queryFn: async () => {
      const { data } = await supabase.from("church_divisions" as any).select("id,nama").order("nama");
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (current) {
      setJabatan(current.jabatan ?? "");
      setDivisionId(current.division_id ?? "");
    } else {
      setJabatan(""); setDivisionId("");
    }
  }, [current]);

  const appoint = async () => {
    if (!jabatan.trim()) { toast.error("Isi jabatan terlebih dulu"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("church_requesters" as any).upsert({
        user_id: member.id,
        jabatan: jabatan.trim(),
        division_id: divisionId || null,
        is_active: true,
        appointed_by: user?.id,
      }, { onConflict: "user_id" });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: member.id,
        judul: "⛪ Wewenang Pengadaan Gereja diberikan",
        pesan: `Anda diangkat sebagai ${jabatan.trim()} dan dapat mengajukan permintaan pembelian gereja.`,
        kategori: "sukses", url: "/gereja/pengadaan",
      });
      toast.success("Wewenang diberikan");
      refetch(); qc.invalidateQueries({ queryKey: ["is-church-requester"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("church_requesters" as any)
        .update({ is_active: false }).eq("user_id", member.id);
      if (error) throw error;
      toast.success("Wewenang dicabut");
      refetch(); qc.invalidateQueries({ queryKey: ["is-church-requester"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Church className="h-4 w-4 text-violet-600" />
        <p className="text-sm font-semibold">Wewenang Pengadaan Gereja</p>
        {current?.is_active && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Aktif</span>}
      </div>
      <p className="text-xs text-muted-foreground">Berikan wewenang kepada <span className="font-semibold">{member.nama_lengkap}</span> untuk mengajukan PR gereja sesuai posisi pelayanannya.</p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Jabatan / Posisi Pelayanan</label>
        <Input value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Mis. Koordinator Musik, PIC Multimedia" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Divisi (opsional)</label>
        <Select value={divisionId || "_none"} onValueChange={(v) => setDivisionId(v === "_none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="— Tanpa divisi default —" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— Tanpa divisi default —</SelectItem>
            {divisions?.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {current?.appointed_at && (
        <p className="text-[11px] text-muted-foreground">Sejak: {new Date(current.appointed_at).toLocaleDateString("id-ID")}</p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        {current?.is_active && (
          <Button size="sm" variant="outline" disabled={busy} onClick={revoke} className="text-destructive">Cabut</Button>
        )}
        <Button size="sm" onClick={appoint} disabled={busy}>{current?.is_active ? "Perbarui" : "Berikan Wewenang"}</Button>
      </div>
    </div>
  );
}

function SchoolRequesterSection({ member }: { member: { id: string; nama_lengkap: string } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [jabatan, setJabatan] = useState("");
  const [unitKerja, setUnitKerja] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: current, refetch } = useQuery({
    queryKey: ["school-requester", member.id],
    queryFn: async () => {
      const { data } = await supabase.from("school_requesters" as any)
        .select("*").eq("user_id", member.id).maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (current) {
      setJabatan(current.jabatan ?? "");
      setUnitKerja(current.unit_kerja ?? "");
    } else {
      setJabatan(""); setUnitKerja("");
    }
  }, [current]);

  const appoint = async () => {
    if (!jabatan.trim()) { toast.error("Isi jabatan terlebih dulu"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("school_requesters" as any).upsert({
        user_id: member.id,
        jabatan: jabatan.trim(),
        unit_kerja: unitKerja.trim() || null,
        is_active: true,
        appointed_by: user?.id,
      }, { onConflict: "user_id" });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: member.id,
        judul: "🎓 Wewenang Pengadaan Sekolah diberikan",
        pesan: `Anda diangkat sebagai ${jabatan.trim()} dan dapat mengajukan permintaan pembelian sekolah.`,
        kategori: "sukses", url: "/sekolah/pengadaan",
      });
      toast.success("Wewenang sekolah diberikan");
      refetch(); qc.invalidateQueries({ queryKey: ["is-school-requester"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("school_requesters" as any)
        .update({ is_active: false }).eq("user_id", member.id);
      if (error) throw error;
      toast.success("Wewenang sekolah dicabut");
      refetch(); qc.invalidateQueries({ queryKey: ["is-school-requester"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold">Wewenang Pengadaan Sekolah</p>
        {current?.is_active && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Aktif</span>}
      </div>
      <p className="text-xs text-muted-foreground">Berikan wewenang kepada <span className="font-semibold">{member.nama_lengkap}</span> untuk mengajukan PR sekolah. Unit kerja sekolah terpisah dari gereja.</p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Jabatan / Posisi</label>
        <Input value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="Mis. Kepala Sekolah, Wakasek Sarpras, Bendahara Sekolah" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Unit Kerja (opsional)</label>
        <Input value={unitKerja} onChange={(e) => setUnitKerja(e.target.value)} placeholder="Mis. SD, SMP, SMA, TU" />
      </div>
      {current?.appointed_at && (
        <p className="text-[11px] text-muted-foreground">Sejak: {new Date(current.appointed_at).toLocaleDateString("id-ID")}</p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        {current?.is_active && (
          <Button size="sm" variant="outline" disabled={busy} onClick={revoke} className="text-destructive">Cabut</Button>
        )}
        <Button size="sm" onClick={appoint} disabled={busy}>{current?.is_active ? "Perbarui" : "Berikan Wewenang"}</Button>
      </div>
    </div>
  );
}


function MemberDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["member-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      let ktpUrl: string | null = null;
      if (data?.ktp_url) {
        const { data: signed } = await supabase.storage.from("ktp").createSignedUrl(data.ktp_url, 120);
        ktpUrl = signed?.signedUrl ?? null;
      }
      const { data: docs } = await supabase.from("documents").select("id,nama,kategori,file_url,created_at").eq("user_id", id!).is("deleted_at", null).order("created_at", { ascending: false });
      return { profile: data, ktpUrl, docs: docs ?? [] };
    },
  });

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("ktp").createSignedUrl(path, 120);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><IdCard className="h-4 w-4" /> Detail Anggota</DialogTitle></DialogHeader>
        {isLoading || !data?.profile ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarImage src={data.profile.foto_url ?? undefined} /><AvatarFallback>{(data.profile.nama_lengkap ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div>
                <p className="font-bold">{data.profile.nama_lengkap}</p>
                <p className="font-mono text-xs text-muted-foreground">{data.profile.nomor_anggota ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{data.profile.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-xs">
              <Info label="NIK" value={data.profile.nik} />
              <Info label="No HP" value={data.profile.no_hp} />
              <Info label="Tempat/Tgl Lahir" value={[data.profile.tempat_lahir, data.profile.tanggal_lahir].filter(Boolean).join(", ")} />
              <Info label="Pekerjaan" value={data.profile.pekerjaan} />
              <Info label="Jenis Kelamin" value={data.profile.jenis_kelamin === "L" ? "Laki-laki" : data.profile.jenis_kelamin === "P" ? "Perempuan" : null} />
              <Info label="Bergabung" value={new Date(data.profile.joined_at).toLocaleDateString("id-ID")} />
              <div className="col-span-2"><Info label="Alamat" value={data.profile.alamat} /></div>
            </div>

            {data.ktpUrl && (
              <div>
                <p className="mb-2 text-xs font-semibold">Foto KTP</p>
                <img src={data.ktpUrl} alt="KTP" className="w-full rounded-lg border border-border" />
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold">Dokumen Pendukung ({data.docs.length})</p>
              {data.docs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada dokumen.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.docs.map((d) => (
                    <button key={d.id} onClick={() => openDoc(d.file_url)} className="flex w-full items-center gap-2 rounded-md border border-border p-2 text-left text-xs hover:bg-muted">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="flex-1 truncate">{d.nama}</span>
                      <span className="text-muted-foreground">{d.kategori}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function ImportCsvButton() {
  const importFn = useServerFn(importMembersCsv);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows = lines.map((l) => {
        const [email, nama_lengkap, no_hp, nik, alamat] = l.split(",").map((s) => s?.trim());
        return { email, nama_lengkap, no_hp, nik, alamat };
      }).filter((r) => r.email && r.nama_lengkap);
      if (rows.length === 0) { toast.error("Tidak ada baris valid"); return; }
      const res = await importFn({ data: { rows } });
      toast.success(`${res.ok} undangan dikirim`, { description: res.errors.length ? `${res.errors.length} gagal` : undefined });
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      setOpen(false); setText("");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Upload className="mr-2 h-3.5 w-3.5" />Import CSV</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Import Anggota dari CSV</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Format per baris: <code className="rounded bg-muted px-1">email,nama,no_hp,nik,alamat</code>. Anggota akan menerima email undangan.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs" placeholder="budi@email.com,Budi Santoso,08123,3201...,Jl. Mawar 1" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim Undangan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDemoButton() {
  const delFn = useServerFn(deleteDemoMembers);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!confirm("Hapus semua anggota data demo? Tindakan ini permanen.")) return;
    setBusy(true);
    try {
      const res = await delFn();
      toast.success(`${res.removed} dari ${res.total} anggota demo dihapus`);
      qc.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5 text-destructive" />}
      Hapus Data Demo
    </Button>
  );
}

type MemberRow = {
  id: string;
  nomor_anggota: string | null;
  nama_lengkap: string;
  email: string | null;
  no_hp: string | null;
  status: string;
  foto_url: string | null;
  joined_at: string;
};

type FilterKind = "all" | "active" | "pending" | "pengurus" | "tunggakan";

function BroadcastWaDialog({ open, onClose, members }: { open: boolean; onClose: () => void; members: MemberRow[] }) {
  const [filter, setFilter] = useState<FilterKind>("active");
  const [templateId, setTemplateId] = useState<string>(WA_TEMPLATES[0].id);
  const [customMsg, setCustomMsg] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Ambil daftar id pengurus
  const { data: pengurusIds } = useQuery({
    queryKey: ["broadcast-pengurus-ids"],
    enabled: open && filter === "pengurus",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["super_admin", "ketua", "sekretaris", "bendahara"])
        .is("deleted_at", null);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id as string));
    },
  });

  // Ambil daftar id user yang punya angsuran belum lunas
  const { data: tunggakanIds } = useQuery({
    queryKey: ["broadcast-tunggakan-ids"],
    enabled: open && filter === "tunggakan",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("angsuran")
        .select("user_id")
        .in("status", ["unpaid", "overdue"]);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id as string));
    },
  });

  const targets = members.filter((m) => {
    if (!normalizePhone(m.no_hp)) return false;
    if (filter === "all") return true;
    if (filter === "active") return m.status === "active";
    if (filter === "pending") return m.status === "pending";
    if (filter === "pengurus") return pengurusIds?.has(m.id) ?? false;
    if (filter === "tunggakan") return tunggakanIds?.has(m.id) ?? false;
    return false;
  });

  const buildMsg = (nama: string) => {
    if (useCustom) return customMsg.replace(/\{nama\}/g, nama);
    const tpl = WA_TEMPLATES.find((t) => t.id === templateId)!;
    return tpl.build(nama);
  };

  // Buka WA satu per satu dengan delay agar tidak terblokir popup blocker
  const sendAll = async () => {
    if (targets.length === 0) {
      toast.error("Tidak ada penerima dengan nomor HP valid.");
      return;
    }
    if (targets.length > 1 && !confirm(`Kirim WA ke ${targets.length} anggota? Browser akan membuka tab WhatsApp satu per satu.`)) return;
    let ok = 0;
    for (const m of targets) {
      const phone = normalizePhone(m.no_hp);
      if (!phone) continue;
      const url = waUrl(phone, buildMsg(m.nama_lengkap));
      window.open(url, "_blank", "noopener,noreferrer");
      ok++;
      // Beri jeda agar popup tidak diblokir browser
      await new Promise((r) => setTimeout(r, 600));
    }
    toast.success(`${ok} tab WhatsApp dibuka. Kirim pesannya di masing-masing tab.`);
    onClose();
  };

  const previewMsg = targets[0] ? buildMsg(targets[0].nama_lengkap) : buildMsg("Anggota");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-success" /> Broadcast WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold">Kirim ke:</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { v: "active", l: "Anggota Aktif" },
                { v: "pending", l: "Menunggu Verifikasi" },
                { v: "pengurus", l: "Pengurus" },
                { v: "tunggakan", l: "Punya Tunggakan" },
                { v: "all", l: "Semua" },
              ] as { v: FilterKind; l: string }[]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFilter(opt.v)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${filter === opt.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:bg-muted"}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {targets.length} penerima dengan nomor HP valid.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold">Pesan:</p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
                Tulis pesan sendiri
              </label>
            </div>
            {useCustom ? (
              <Textarea
                rows={5}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                placeholder="Tulis pesan. Gunakan {nama} untuk menyisipkan nama anggota."
                maxLength={1000}
              />
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WA_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <p className="mb-1 font-semibold text-foreground">Pratinjau:</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{previewMsg}</p>
          </div>

          <div className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
            ⚠️ WhatsApp akan terbuka satu tab per anggota. Anda harus menekan tombol kirim di tiap tab (kebijakan WhatsApp untuk mencegah spam).
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={sendAll} disabled={targets.length === 0 || (useCustom && !customMsg.trim())} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Kirim ke {targets.length} Anggota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
