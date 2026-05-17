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
import { Loader2, Search, CheckCircle2, XCircle, Pause, Eye, IdCard, FileText, Printer, Upload, Trash2, ShieldCheck, MessageCircle, Send } from "lucide-react";
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

  const { data, isLoading } = useQuery({
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
    const ch = supabase.channel("admin-members-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => qc.invalidateQueries({ queryKey: ["admin-members"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "rejected" }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
      // audit + notif
      await Promise.all([
        supabase.from("audit_logs").insert({
          actor_id: user?.id, entity: "profiles", entity_id: id,
          action: `member_${status}`, new_data: { status },
        }),
        supabase.from("notifications").insert({
          user_id: id,
          judul: status === "active" ? "Akun Anda telah diaktifkan" : status === "suspended" ? "Akun ditangguhkan" : "Pendaftaran ditolak",
          pesan: status === "active"
            ? "Selamat! Akun Anda telah diverifikasi pengurus dan dapat digunakan sepenuhnya."
            : status === "suspended" ? "Akun Anda ditangguhkan oleh pengurus. Silakan hubungi sekretaris."
            : "Pendaftaran Anda ditolak. Hubungi pengurus untuk informasi lanjut.",
          kategori: status === "active" ? "sukses" : status === "suspended" ? "peringatan" : "error",
          ref_table: "profiles", ref_id: id,
        }),
      ]);
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
        <div className="flex flex-wrap items-center gap-2">
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
                            <Button size="sm" variant="ghost" onClick={() => setRoleMember({ id: m.id, nama_lengkap: m.nama_lengkap })} title="Jadikan Pengurus">
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Kelola Jabatan Pengurus</DialogTitle>
        </DialogHeader>
        {member && (
          <div className="space-y-3">
            <p className="text-sm">Pilih jabatan untuk <span className="font-semibold">{member.nama_lengkap}</span>. Jabatan dapat diaktifkan/dicabut kapan saja.</p>
            <div className="space-y-2">
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
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
