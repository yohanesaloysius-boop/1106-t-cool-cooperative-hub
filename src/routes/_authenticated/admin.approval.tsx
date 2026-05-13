import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, FileSignature, Plus, QrCode, History as HistoryIcon, Inbox, ShieldCheck, Loader2 } from "lucide-react";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/admin/approval")({
  head: () => ({ meta: [{ title: "Approval Digital — T-COOL" }] }),
  component: AdminApprovalPage,
});

type ApprovalRole = "sekretaris" | "bendahara" | "ketua";
type TargetType = "pinjaman" | "simpanan" | "anggota" | "pengumuman" | "lainnya";
type Status = "pending" | "approved" | "rejected" | "cancelled";

const TARGET_LABEL: Record<string, string> = {
  pinjaman: "Pinjaman",
  simpanan: "Simpanan",
  anggota: "Anggota",
  pengumuman: "Pengumuman",
  lainnya: "Dokumen",
};

const DOC_KIND_OPTIONS = [
  { v: "shu", label: "Distribusi SHU" },
  { v: "laporan", label: "Laporan Keuangan" },
  { v: "sk", label: "Surat Keputusan" },
  { v: "ba", label: "Berita Acara" },
  { v: "lainnya", label: "Lainnya" },
];

function statusBadge(s: Status) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    pending: { label: "Pending", cls: "bg-warning/15 text-warning border-warning/30", Icon: Clock },
    approved: { label: "Approved", cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
  };
  const { label, cls, Icon } = map[s];
  return <Badge variant="outline" className={cls}><Icon className="mr-1 h-3 w-3" />{label}</Badge>;
}

function AdminApprovalPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const myRole: ApprovalRole | null = roles.includes("ketua") ? "ketua" : roles.includes("bendahara") ? "bendahara" : roles.includes("sekretaris") ? "sekretaris" : roles.includes("super_admin") ? "ketua" : null;

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["approvals-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // realtime
  useEffect(() => {
    const ch = supabase.channel("approvals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => qc.invalidateQueries({ queryKey: ["approvals-all"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_histories" }, () => qc.invalidateQueries({ queryKey: ["approvals-all"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const queue = useMemo(() => approvals.filter((a) => a.status === "pending" && (myRole ? a.required_role === myRole : true)), [approvals, myRole]);
  const history = useMemo(() => approvals.filter((a) => a.status !== "pending"), [approvals]);

  if (!isPengurus) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Hanya pengurus yang dapat mengakses halaman ini.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Digital</h1>
          <p className="text-sm text-muted-foreground">Workflow persetujuan multi-role dengan tanda tangan digital & QR verifikasi.</p>
        </div>
        <div className="flex gap-2">
          <NewApprovalDialog userId={user!.id} onCreated={() => qc.invalidateQueries({ queryKey: ["approvals-all"] })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Inbox} label="Antrian Saya" value={queue.length} tone="warning" />
        <KpiCard icon={Clock} label="Pending Total" value={approvals.filter((a) => a.status === "pending").length} />
        <KpiCard icon={CheckCircle2} label="Approved" value={approvals.filter((a) => a.status === "approved").length} tone="success" />
        <KpiCard icon={XCircle} label="Rejected" value={approvals.filter((a) => a.status === "rejected").length} tone="destructive" />
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue"><Inbox className="mr-1 h-4 w-4" />Antrian {myRole ? `(${myRole})` : ""}</TabsTrigger>
          <TabsTrigger value="all"><ShieldCheck className="mr-1 h-4 w-4" />Semua</TabsTrigger>
          <TabsTrigger value="history"><HistoryIcon className="mr-1 h-4 w-4" />Histori</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <ApprovalList rows={queue} loading={isLoading} userId={user!.id} myRole={myRole} emptyText="Tidak ada item menunggu persetujuan Anda." />
        </TabsContent>
        <TabsContent value="all">
          <ApprovalList rows={approvals} loading={isLoading} userId={user!.id} myRole={myRole} emptyText="Belum ada approval." />
        </TabsContent>
        <TabsContent value="history">
          <ApprovalList rows={history} loading={isLoading} userId={user!.id} myRole={myRole} emptyText="Belum ada histori." historyOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${cls}`}><Icon className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ApprovalRow = {
  id: string;
  target_type: TargetType;
  target_id: string;
  required_role: ApprovalRole;
  status: Status;
  step_order: number;
  catatan: string | null;
  approver_id: string | null;
  acted_at: string | null;
  created_at: string;
  created_by: string | null;
};

function ApprovalList({ rows, loading, userId, myRole, emptyText, historyOnly }: { rows: ApprovalRow[]; loading: boolean; userId: string; myRole: ApprovalRole | null; emptyText: string; historyOnly?: boolean }) {
  if (loading) return <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  if (!rows.length) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{emptyText}</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dokumen</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{TARGET_LABEL[r.target_type] ?? r.target_type}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">#{r.target_id.slice(0, 8)}</div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.required_role}</Badge></TableCell>
                <TableCell>{r.step_order}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right">
                  <ApprovalDetailDialog row={r} userId={userId} canAct={!historyOnly && r.status === "pending" && myRole === r.required_role} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ApprovalDetailDialog({ row, userId, canAct }: { row: ApprovalRow; userId: string; canAct: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const { data: histories = [] } = useQuery({
    queryKey: ["approval-history", row.id],
    queryFn: async () => {
      const { data } = await supabase.from("approval_histories").select("*").eq("approval_id", row.id).order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const verifyUrl = `${window.location.origin}/verify/${row.id}`;
    QRCode.toDataURL(verifyUrl, { width: 180, margin: 1 }).then(setQrUrl).catch(() => setQrUrl(null));
  }, [open, row.id]);

  const act = async (action: "approved" | "rejected", sig?: SignatureResult) => {
    setBusy(true);
    try {
      let signatureId: string | null = null;
      if (sig) {
        const { data: srow, error: serr } = await supabase.from("signatures").insert({
          user_id: userId,
          signature_url: sig.dataUrl,
          hash: sig.hash,
          ref_table: "approvals",
          ref_id: row.id,
        }).select("id").single();
        if (serr) throw serr;
        signatureId = srow.id;
      }
      const { error: uerr } = await supabase.from("approvals").update({
        status: action,
        approver_id: userId,
        acted_at: new Date().toISOString(),
        catatan: note.trim() || null,
        updated_by: userId,
      }).eq("id", row.id);
      if (uerr) throw uerr;

      await supabase.from("approval_histories").insert({
        approval_id: row.id,
        actor_id: userId,
        actor_role: row.required_role,
        action,
        catatan: note.trim() || null,
        signature_id: signatureId,
      });

      // If approved & there's a next step, move next step to pending (already pending by default, so just notify)
      // Audit log + notify creator
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: `approval.${action}`,
        entity: "approvals",
        entity_id: row.id,
        new_data: { target_type: row.target_type, target_id: row.target_id, step: row.step_order, signed: !!sig },
      });
      if (row.created_by) {
        await supabase.from("notifications").insert({
          user_id: row.created_by,
          judul: `Approval ${action === "approved" ? "Disetujui" : "Ditolak"}`,
          pesan: `${TARGET_LABEL[row.target_type] ?? row.target_type} step ${row.step_order} (${row.required_role}) telah ${action === "approved" ? "disetujui" : "ditolak"}.`,
          kategori: action === "approved" ? "success" : "warning",
          ref_table: "approvals",
          ref_id: row.id,
        });
      }

      toast.success(action === "approved" ? "Approval berhasil ditandatangani." : "Approval ditolak.");
      qc.invalidateQueries({ queryKey: ["approvals-all"] });
      qc.invalidateQueries({ queryKey: ["approval-history", row.id] });
      setOpen(false);
      setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Detail</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="h-4 w-4" />Detail Approval</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Dokumen</p>
              <p className="font-medium">{TARGET_LABEL[row.target_type] ?? row.target_type}</p>
              <p className="font-mono text-[11px] text-muted-foreground break-all">#{row.target_id}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-xs text-muted-foreground">Role</p><p className="capitalize">{row.required_role}</p></div>
              <div><p className="text-xs text-muted-foreground">Step</p><p>{row.step_order}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p>{statusBadge(row.status)}</div>
              <div><p className="text-xs text-muted-foreground">Dibuat</p><p>{new Date(row.created_at).toLocaleString("id-ID")}</p></div>
              {row.acted_at && <div className="col-span-2"><p className="text-xs text-muted-foreground">Diproses</p><p>{new Date(row.acted_at).toLocaleString("id-ID")}</p></div>}
              {row.catatan && <div className="col-span-2"><p className="text-xs text-muted-foreground">Catatan</p><p className="rounded bg-muted p-2 text-xs">{row.catatan}</p></div>}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Histori Tindakan</p>
              <div className="space-y-2">
                {histories.length === 0 && <p className="text-xs text-muted-foreground">Belum ada tindakan.</p>}
                {histories.map((h) => (
                  <div key={h.id} className="rounded-lg border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{h.action}</Badge>
                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("id-ID")}</span>
                    </div>
                    {h.catatan && <p className="mt-1 text-muted-foreground">{h.catatan}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-3 text-center">
              <p className="mb-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><QrCode className="h-3 w-3" />QR Verifikasi Dokumen</p>
              {qrUrl ? <img src={qrUrl} alt="QR" className="mx-auto h-40 w-40" /> : <div className="mx-auto h-40 w-40 animate-pulse rounded bg-muted" />}
              <Link to="/verify/$id" params={{ id: row.id }} className="text-xs text-primary hover:underline">Buka halaman verifikasi</Link>
            </div>

            {canAct && (
              <div className="space-y-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tambahkan catatan persetujuan..." rows={3} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {canAct ? (
            <>
              <Button variant="outline" onClick={() => act("rejected")} disabled={busy}>
                <XCircle className="mr-1 h-4 w-4" />Reject
              </Button>
              <SignaturePadDialog
                title="Tanda Tangan Persetujuan"
                onSign={(sig) => act("approved", sig)}
                trigger={<Button disabled={busy}><FileSignature className="mr-1 h-4 w-4" />Tanda Tangani & Approve</Button>}
              />
            </>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewApprovalDialog({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [docKind, setDocKind] = useState("sk");
  const [target, setTarget] = useState<TargetType>("lainnya");
  const [refId, setRefId] = useState("");
  const [note, setNote] = useState("");
  const [roles, setRoles] = useState<ApprovalRole[]>(["sekretaris", "bendahara", "ketua"]);
  const [busy, setBusy] = useState(false);

  const toggleRole = (r: ApprovalRole) => setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const submit = async () => {
    if (!roles.length) { toast.error("Pilih minimal satu role approver."); return; }
    setBusy(true);
    try {
      const tid = refId.trim() || crypto.randomUUID();
      const order: ApprovalRole[] = ["sekretaris", "bendahara", "ketua"].filter((r) => roles.includes(r as ApprovalRole)) as ApprovalRole[];
      const rows = order.map((r, i) => ({
        target_type: target,
        target_id: tid,
        required_role: r,
        step_order: i + 1,
        status: "pending" as const,
        catatan: i === 0 ? `[${docKind.toUpperCase()}] ${note.trim()}` : null,
        created_by: userId,
      }));
      const { error } = await supabase.from("approvals").insert(rows);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "approval.created",
        entity: "approvals",
        entity_id: tid,
        new_data: { docKind, target, steps: order, note },
      });
      toast.success(`Workflow approval dibuat (${order.length} step).`);
      onCreated();
      setOpen(false);
      setRefId(""); setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Approval Baru</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Buat Workflow Approval</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Jenis Dokumen</Label>
              <Select value={docKind} onValueChange={setDocKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_KIND_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Kategori Target</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as TargetType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lainnya">Dokumen / SK / BA</SelectItem>
                  <SelectItem value="pinjaman">Pinjaman</SelectItem>
                  <SelectItem value="simpanan">Simpanan</SelectItem>
                  <SelectItem value="anggota">Anggota</SelectItem>
                  <SelectItem value="pengumuman">Pengumuman</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>ID Referensi (opsional)</Label>
            <Input value={refId} onChange={(e) => setRefId(e.target.value)} placeholder="Kosongkan untuk auto-generate" />
          </div>
          <div className="space-y-1">
            <Label>Catatan / Deskripsi</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ringkasan dokumen yang akan disetujui..." />
          </div>
          <div className="space-y-2">
            <Label>Urutan Approver</Label>
            <div className="flex flex-wrap gap-2">
              {(["sekretaris", "bendahara", "ketua"] as const).map((r) => (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${roles.includes(r) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Step dijalankan urut: sekretaris → bendahara → ketua.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Memproses..." : "Buat Workflow"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}