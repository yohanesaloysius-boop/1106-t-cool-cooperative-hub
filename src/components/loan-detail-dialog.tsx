import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/empty-state";
import { Loader2, FileText, ExternalLink } from "lucide-react";

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function LoanDetailDialog({ pinjamanId, trigger }: { pinjamanId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["loan-detail", pinjamanId],
    enabled: open,
    queryFn: async () => {
      const [{ data: pin }, { data: ang }, { data: appr }] = await Promise.all([
        supabase.from("pinjaman").select("*").eq("id", pinjamanId).maybeSingle(),
        supabase.from("angsuran").select("*").eq("pinjaman_id", pinjamanId).order("cicilan_ke", { ascending: true }),
        supabase.from("approvals").select("*").eq("target_id", pinjamanId).order("step_order", { ascending: true }),
      ]);
      return { pin, angsuran: ang ?? [], approvals: appr ?? [] };
    },
  });

  const openDoc = async (path: string) => {
    if (path.startsWith("http")) { window.open(path, "_blank"); return; }
    const { data } = await supabase.storage.from("ktp").createSignedUrl(path, 120);
    if (data) window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Detail Pinjaman</DialogTitle></DialogHeader>
        {isLoading || !data?.pin ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl p-5 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <p className="text-xs opacity-80">Nominal Pinjaman</p>
              <p className="text-2xl font-bold">{fmt.format(Number(data.pin.nominal))}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="opacity-75">Tenor</p><p className="font-semibold">{data.pin.tenor_bulan} bln</p></div>
                <div><p className="opacity-75">Cicilan</p><p className="font-semibold">{fmt.format(Number(data.pin.cicilan_per_bulan ?? 0))}</p></div>
                <div><p className="opacity-75">Total</p><p className="font-semibold">{fmt.format(Number(data.pin.total_bayar ?? 0))}</p></div>
              </div>
              <div className="mt-3"><StatusBadge status={data.pin.status} /></div>
            </div>

            {data.pin.tujuan && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">Tujuan</p>
                <p>{data.pin.tujuan}</p>
              </div>
            )}

            {data.pin.dokumen_url && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => openDoc(data.pin!.dokumen_url!)}>
                <FileText className="h-4 w-4" /> Lihat Dokumen Pendukung <ExternalLink className="h-3 w-3" />
              </Button>
            )}

            {data.approvals.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold">Riwayat Approval</p>
                <div className="space-y-1.5">
                  {data.approvals.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                      <span className="font-medium capitalize">{a.required_role}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold">Jadwal Angsuran ({data.angsuran.length})</p>
              {data.angsuran.length === 0 ? (
                <p className="text-xs text-muted-foreground">Jadwal akan tersedia setelah pinjaman dicairkan.</p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Jatuh Tempo</th>
                        <th className="p-2 text-right">Nominal</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.angsuran.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="p-2">{a.cicilan_ke}</td>
                          <td className="p-2">{new Date(a.jatuh_tempo).toLocaleDateString("id-ID")}</td>
                          <td className="p-2 text-right font-mono">{fmt.format(Number(a.nominal))}</td>
                          <td className="p-2 text-right"><StatusBadge status={a.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
