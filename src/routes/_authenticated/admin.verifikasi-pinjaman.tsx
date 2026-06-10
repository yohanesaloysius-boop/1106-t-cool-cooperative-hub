import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { ShieldCheck, ShieldX, Loader2, MapPin, Clock, IdCard, ScanFace } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/verifikasi-pinjaman")({
  head: () => ({ meta: [{ title: "Verifikasi Identitas Pinjaman — Admin" }] }),
  component: AdminVerificationPage,
});

function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let active = true;
    supabase.storage.from("verifikasi-pinjaman").createSignedUrl(path, 600).then(({ data }) => {
      if (active) setUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [path]);
  return url;
}

function AdminVerificationPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [note, setNote] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-loan-verifications"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("loan_verifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      const verifIds = (rows ?? []).map((r) => r.id);
      let profMap = new Map<string, any>();
      let pinMap = new Map<string, any>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nama_lengkap,nomor_anggota,no_hp").in("id", userIds);
        profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      }
      if (verifIds.length) {
        const { data: pins } = await supabase
          .from("pinjaman")
          .select("id,verification_id,nominal,tenor_bulan,tujuan,status,created_at")
          .in("verification_id", verifIds);
        pinMap = new Map(((pins ?? []) as any[]).map((p) => [p.verification_id, p]));
      }
      // Also surface "orphan" pinjaman submissions (verification_id null) so admin masih melihat pengajuan
      const { data: orphans } = await supabase
        .from("pinjaman")
        .select("id,user_id,nominal,tenor_bulan,tujuan,status,created_at")
        .is("verification_id", null)
        .in("status", ["pending_sekretaris", "pending_bendahara", "pending_ketua"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (orphans && orphans.length) {
        const oUserIds = Array.from(new Set(orphans.map((o: any) => o.user_id)));
        const missing = oUserIds.filter((id) => !profMap.has(id));
        if (missing.length) {
          const { data: profs2 } = await supabase.from("profiles").select("id,nama_lengkap,nomor_anggota,no_hp").in("id", missing);
          (profs2 ?? []).forEach((p: any) => profMap.set(p.id, p));
        }
      }
      const main = (rows ?? []).map((r: any) => ({ ...r, profile: profMap.get(r.user_id), pinjaman: pinMap.get(r.id) }));
      const orphanRows = (orphans ?? []).map((o: any) => ({
        id: `orphan-${o.id}`,
        user_id: o.user_id,
        status: "no_verification",
        created_at: o.created_at,
        ktp_image_path: null,
        selfie_image_path: null,
        profile: profMap.get(o.user_id),
        pinjaman: o,
        _orphan: true,
      }));
      return [...main, ...orphanRows];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const { error } = await supabase.rpc("mp_review_loan_verification" as any, { _id: id, _action: action, _catatan: note || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Berhasil diproses");
      setSelected(null); setNote("");
      qc.invalidateQueries({ queryKey: ["admin-loan-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ktpUrl = useSignedUrl(selected?.ktp_image_path);
  const selfieUrl = useSignedUrl(selected?.selfie_image_path);

  const pending = (data ?? []).filter((r: any) => r.status === "pending" || r.status === "no_verification");
  const reviewed = (data ?? []).filter((r: any) => r.status !== "pending" && r.status !== "no_verification");

  const fmtIDR = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  const renderCard = (r: any) => (
    <button
      key={r.id}
      onClick={() => { setSelected(r); setNote(""); }}
      className="w-full rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{r.profile?.nama_lengkap ?? "—"}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{r.profile?.nomor_anggota ?? ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">{r.profile?.no_hp}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          r.status === "pending" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
          r.status === "verified" ? "bg-success/15 text-success" :
          r.status === "no_verification" ? "bg-muted text-muted-foreground" :
          "bg-destructive/15 text-destructive"
        }`}>{r.status === "no_verification" ? "tanpa verifikasi" : r.status}</span>
      </div>
      {r.pinjaman && (
        <div className="mt-2 rounded-md bg-muted/50 px-2 py-1 text-[11px]">
          <span className="font-semibold text-foreground">{fmtIDR(Number(r.pinjaman.nominal))}</span>
          <span className="text-muted-foreground"> · {r.pinjaman.tenor_bulan} bln · {r.pinjaman.status}</span>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> {new Date(r.created_at).toLocaleString("id-ID")}
        {r.location?.lat && <><MapPin className="ml-2 h-3 w-3" /> Lokasi tercatat</>}
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /> Verifikasi Identitas Pinjaman</h1>
        <p className="text-sm text-muted-foreground">Review foto KTP & selfie anggota sebelum pinjaman diproses lebih lanjut.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Menunggu Verifikasi ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : pending.length === 0 ? (
            <EmptyState title="Tidak ada verifikasi pending" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pending.map(renderCard)}</div>
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histori ({reviewed.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{reviewed.map(renderCard)}</div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Verifikasi Identitas</DialogTitle>
            <DialogDescription>Bandingkan foto KTP & selfie anggota lalu setujui atau tolak verifikasi ini.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><IdCard className="h-3 w-3" /> Foto KTP</p>
                  {ktpUrl ? <img src={ktpUrl} alt="KTP" className="w-full rounded-lg border" /> : <div className="aspect-video animate-pulse rounded-lg bg-muted" />}
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><ScanFace className="h-3 w-3" /> Selfie</p>
                  {selfieUrl ? <img src={selfieUrl} alt="Selfie" className="w-full rounded-lg border" /> : <div className="aspect-video animate-pulse rounded-lg bg-muted" />}
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-xs">
                <p><strong>Nama:</strong> {selected.profile?.nama_lengkap}</p>
                <p><strong>No. Anggota:</strong> {selected.profile?.nomor_anggota ?? "-"}</p>
                <p><strong>No. HP:</strong> {selected.profile?.no_hp ?? "-"}</p>
                <p><strong>Waktu submit:</strong> {new Date(selected.created_at).toLocaleString("id-ID")}</p>
                {selected.location?.lat && <p><strong>Lokasi:</strong> {selected.location.lat.toFixed(4)}, {selected.location.lng.toFixed(4)}</p>}
                <p className="truncate"><strong>User Agent:</strong> <span className="text-muted-foreground">{selected.user_agent}</span></p>
                {selected.face_match_score != null && <p><strong>Face match score:</strong> {selected.face_match_score}</p>}
                {selected.admin_notes && <p className="mt-1"><strong>Catatan sebelumnya:</strong> {selected.admin_notes}</p>}
              </div>
              {selected.status === "pending" && (
                <Textarea
                  placeholder="Catatan admin (alasan jika ditolak)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              )}
            </div>
          )}
          <DialogFooter>
            {selected?.status === "pending" ? (
              <>
                <Button variant="outline" onClick={() => review.mutate({ id: selected.id, action: "reject" })} disabled={review.isPending} className="gap-1">
                  <ShieldX className="h-4 w-4" /> Tolak
                </Button>
                <Button onClick={() => review.mutate({ id: selected.id, action: "approve" })} disabled={review.isPending} className="gap-1">
                  {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Setujui
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelected(null)}>Tutup</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
