import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { calcLoan } from "@/components/dashboard/loan-calculator";
import { Loader2, PenLine, XCircle, Banknote, FileSignature } from "lucide-react";
import { AkadSignDialog, AkadDownloadButton } from "@/components/akad-sign-dialog";
import { useQuery as useRq } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/admin/pinjaman")({
  head: () => ({ meta: [{ title: "Approval Pinjaman — T-COOL Koperasi" }] }),
  component: PinjamanApprovalPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const stageByRole: Record<string, string> = {
  sekretaris: "pending_sekretaris",
  bendahara: "pending_bendahara",
  ketua: "pending_ketua",
};
const nextStatusFromStage: Record<string, "pending_bendahara" | "pending_ketua" | "approved"> = {
  pending_sekretaris: "pending_bendahara",
  pending_bendahara: "pending_ketua",
  pending_ketua: "approved",
};

export function PinjamanApprovalPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isSuper = roles.includes("super_admin");
  const isBendahara = roles.includes("bendahara") || isSuper;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pinjaman"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("pinjaman")
        .select("id,user_id,nominal,tenor_bulan,bunga_persen,bunga_jenis,tujuan,status,created_at,cicilan_per_bulan,total_bayar")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      let map = new Map<string, { nama_lengkap: string | null; nomor_anggota: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,nama_lengkap,nomor_anggota,nik,alamat")
          .in("id", ids);
        map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      const pids = (rows ?? []).map((r) => r.id);
      let akadMap = new Map<string, any>();
      if (pids.length) {
        const { data: akads } = await (supabase.from("loan_agreements" as any)
          .select("pinjaman_id,id,status,pdf_path,member_signed_at,pengurus_signed_at")
          .in("pinjaman_id", pids));
        akadMap = new Map(((akads as any[]) ?? []).map((a) => [a.pinjaman_id, a]));
      }
      return (rows ?? []).map((r) => ({ ...r, profiles: map.get(r.user_id) ?? null, akad: akadMap.get(r.id) ?? null }));
    },
  });

  const recordSignature = async (sig: SignatureResult, refId: string) => {
    const { data, error } = await supabase
      .from("signatures")
      .insert({
        user_id: user!.id,
        signature_url: sig.dataUrl,
        hash: sig.hash,
        ref_table: "pinjaman",
        ref_id: refId,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const approve = useMutation({
    mutationFn: async ({ row, sig }: { row: any; sig: SignatureResult }) => {
      const next = nextStatusFromStage[row.status as keyof typeof nextStatusFromStage];
      if (!next) throw new Error("Status tidak valid untuk approval.");
      const sigId = await recordSignature(sig, row.id);
      const updates: { status: typeof next; approved_at?: string } = { status: next };
      if (next === "approved") updates.approved_at = new Date().toISOString();
      const { error } = await supabase.from("pinjaman").update(updates).eq("id", row.id);
      if (error) throw error;

      // approval record
      await supabase.from("approvals").insert({
        target_type: "pinjaman",
        target_id: row.id,
        required_role: roles.find((r) => stageByRole[r] === row.status) ?? "sekretaris",
        status: "approved",
        approver_id: user!.id,
        catatan: `Disetujui oleh ${sig.fullName}`,
        acted_at: new Date().toISOString(),
      });
      await supabase.from("notifications").insert({
        user_id: row.user_id,
        judul: "Pengajuan Pinjaman Diproses",
        pesan: `Pinjaman ${fmt.format(Number(row.nominal))} berlanjut ke tahap berikutnya.`,
        kategori: "approval",
      });
      return { sigId };
    },
    onSuccess: () => {
      toast.success("Pinjaman disetujui & diteruskan");
      qc.invalidateQueries({ queryKey: ["admin-pinjaman"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from("pinjaman").update({ status: "rejected" }).eq("id", row.id);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: row.user_id,
        judul: "Pengajuan Pinjaman Ditolak",
        pesan: `Pinjaman ${fmt.format(Number(row.nominal))} ditolak oleh pengurus.`,
        kategori: "peringatan",
      });
    },
    onSuccess: () => { toast.success("Pinjaman ditolak"); qc.invalidateQueries({ queryKey: ["admin-pinjaman"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const disburse = useMutation({
    mutationFn: async ({ row, sig }: { row: any; sig: SignatureResult }) => {
      await recordSignature(sig, row.id);
      const c = calcLoan(Number(row.nominal), row.tenor_bulan, Number(row.bunga_persen), row.bunga_jenis);
      const { error } = await supabase.from("pinjaman").update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        cicilan_per_bulan: c.cicilan,
        total_bayar: c.totalBayar,
      }).eq("id", row.id);
      if (error) throw error;

      // generate angsuran schedule
      const today = new Date();
      const rows = c.schedule.map((s) => {
        const due = new Date(today.getFullYear(), today.getMonth() + s.ke, today.getDate());
        return {
          pinjaman_id: row.id,
          user_id: row.user_id,
          cicilan_ke: s.ke,
          jatuh_tempo: due.toISOString().slice(0, 10),
          nominal: s.cicilan,
          status: "unpaid" as const,
        };
      });
      const { error: e2 } = await supabase.from("angsuran").insert(rows);
      if (e2) throw e2;

      await supabase.from("transaksi").insert({
        user_id: row.user_id,
        jenis: "pinjaman_cair",
        arah: "debit",
        nominal: row.nominal,
        ref_table: "pinjaman",
        ref_id: row.id,
        keterangan: "Pencairan pinjaman",
      });
      await supabase.from("notifications").insert({
        user_id: row.user_id,
        judul: "Pinjaman Dicairkan",
        pesan: `Dana ${fmt.format(Number(row.nominal))} telah dicairkan. Jadwal angsuran tersedia.`,
        kategori: "sukses",
      });
    },
    onSuccess: () => { toast.success("Pinjaman dicairkan & angsuran dibuat"); qc.invalidateQueries({ queryKey: ["admin-pinjaman"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canApprove = (status: string) => {
    if (isSuper) return Object.keys(nextStatusFromStage).includes(status);
    return roles.some((r) => stageByRole[r] === status);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approval Pinjaman</h1>
        <p className="text-sm text-muted-foreground">Workflow berlapis: Sekretaris → Bendahara → Ketua, lalu pencairan oleh Bendahara.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Pengajuan</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (data ?? []).length === 0 ? (
            <EmptyState title="Belum ada pengajuan" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="hidden md:table-cell">Tenor / Bunga</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.profiles?.nama_lengkap ?? "—"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{r.profiles?.nomor_anggota ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt.format(Number(r.nominal))}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{r.tenor_bulan} bln · {Number(r.bunga_persen)}% {r.bunga_jenis}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApprove(r.status) && (
                            <>
                              <SignaturePadDialog
                                title="Setujui Pinjaman"
                                onSign={async (sig) => { await approve.mutateAsync({ row: r, sig }); }}
                                trigger={<Button size="sm" variant="ghost"><PenLine className="h-4 w-4 text-success" /></Button>}
                              />
                              <Button size="sm" variant="ghost" onClick={() => reject.mutate(r)}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {r.status === "approved" && isBendahara && (
                            <SignaturePadDialog
                              title="Cairkan Pinjaman"
                              onSign={(sig) => disburse.mutateAsync({ row: r, sig })}
                              trigger={<Button size="sm" variant="outline" className="gap-1 text-xs"><Banknote className="h-3 w-3" /> Cairkan</Button>}
                            />
                          )}
                          {r.akad?.status === "pending_pengurus" && (
                            <AkadSignDialog
                              role="pengurus"
                              jabatan="Ketua/Bendahara"
                              pinjaman={r}
                              profile={{
                                nama: r.profiles?.nama_lengkap ?? "—",
                                nomor: r.profiles?.nomor_anggota ?? null,
                                nik: (r.profiles as any)?.nik ?? null,
                                alamat: (r.profiles as any)?.alamat ?? null,
                              }}
                              trigger={<Button size="sm" variant="outline" className="gap-1 text-xs"><FileSignature className="h-3 w-3" /> TTD Akad</Button>}
                            />
                          )}
                          {r.akad?.pdf_path && <AkadDownloadButton pdfPath={r.akad.pdf_path} />}
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
