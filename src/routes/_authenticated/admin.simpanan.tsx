import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { getSignedUrl } from "@/lib/upload";

async function openBukti(url: string) {
  if (!url) return;
  if (/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  // stored as storage path -> sign it
  const signed = await getSignedUrl("bukti-transfer", url, 60 * 60);
  if (signed) window.open(signed, "_blank", "noopener,noreferrer");
  else toast.error("Bukti tidak dapat dibuka");
}

export const Route = createFileRoute("/_authenticated/admin/simpanan")({
  head: () => ({ meta: [{ title: "Verifikasi Simpanan — T-COOL Koperasi" }] }),
  component: SimpananVerifyPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const jenisLabel: Record<string, string> = { pokok: "Pokok", wajib: "Wajib", sukarela: "Sukarela" };

export function SimpananVerifyPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-simpanan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simpanan")
        .select("id,user_id,jenis,nominal,bukti_url,status,created_at,catatan, profiles:user_id(nama_lengkap,nomor_anggota)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const verify = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "verified" | "rejected" }) => {
      const { error } = await supabase
        .from("simpanan")
        .update({ status, verified_at: new Date().toISOString(), verified_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;

      if (status === "verified") {
        const row = (data ?? []).find((r) => r.id === id);
        if (row) {
          await supabase.from("transaksi").insert({
            user_id: row.user_id,
            jenis: "simpanan_masuk",
            arah: "kredit",
            nominal: row.nominal,
            ref_table: "simpanan",
            ref_id: row.id,
            keterangan: `Setoran simpanan ${jenisLabel[row.jenis]}`,
          });
          await supabase.from("notifications").insert({
            user_id: row.user_id,
            judul: "Simpanan Diverifikasi",
            pesan: `Setoran ${jenisLabel[row.jenis]} sebesar ${fmt.format(Number(row.nominal))} telah diverifikasi.`,
            kategori: "sukses",
          });
        }
      }
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "verified" ? "Setoran diverifikasi" : "Setoran ditolak");
      qc.invalidateQueries({ queryKey: ["admin-simpanan"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verifikasi Simpanan</h1>
        <p className="text-sm text-muted-foreground">Tinjau bukti setoran anggota & verifikasi.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Setoran</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (data ?? []).length === 0 ? (
            <EmptyState title="Belum ada setoran" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead>Bukti</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{(r as any).profiles?.nama_lengkap ?? "—"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{(r as any).profiles?.nomor_anggota ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-xs">{jenisLabel[r.jenis]}</TableCell>
                      <TableCell className="text-right font-medium">{fmt.format(Number(r.nominal))}</TableCell>
                      <TableCell>
                        {r.bukti_url ? (
                          <button type="button" onClick={() => openBukti(r.bukti_url as string)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            Lihat <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => verify.mutate({ id: r.id, status: "verified" })}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => verify.mutate({ id: r.id, status: "rejected" })}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
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
