import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, CheckCircle2, Clock, XCircle, Package, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sekolah/pengadaan/$id")({
  head: () => ({ meta: [{ title: "Detail PR — Pengadaan Sekolah" }] }),
  component: PRDetail,
});

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Diajukan", approved_finance: "Disetujui Keuangan",
  approved_ketua: "Disetujui Ketua", forwarded_to_koperasi: "Di Koperasi",
  vendor_selected: "Vendor Dipilih", po_issued: "PO Terbit",
  paid_vendor: "Bayar Vendor", fee_paid: "Fee Dibayar", received: "Diterima",
  closed: "Selesai", rejected: "Ditolak", cancelled: "Dibatalkan",
};

function PRDetail() {
  const { id } = useParams({ from: "/_authenticated/sekolah/pengadaan/$id" });
  const { user } = useAuth();

  const { data: pr } = useQuery({
    queryKey: ["school-pr", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_purchase_requests" as any)
        .select("*, school_divisions(nama), school_pr_items(*), school_purchase_orders(*, school_vendors(nama)), school_pr_payments(*), school_pr_receipts(*), school_pr_audit(*)")
        .eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  if (!pr) return <div className="text-sm text-muted-foreground">Memuat...</div>;

  const audit = (pr.school_pr_audit ?? []).sort((a: any, b: any) => +new Date(a.created_at) - +new Date(b.created_at));
  const isOwner = pr.requester_id === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={isOwner ? "/sekolah/pengadaan" : "/admin/sekolah/pengadaan"}><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        </Button>
        <Badge>{STATUS_LABEL[pr.status] ?? pr.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{pr.judul}</CardTitle>
          <p className="text-xs text-muted-foreground font-mono">{pr.nomor_pr}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid sm:grid-cols-3 gap-3">
            <Info label="Unit" value={pr.school_divisions?.nama ?? "—"} />
            <Info label="Urgensi" value={pr.urgensi} />
            <Info label="Diajukan" value={new Date(pr.created_at).toLocaleDateString("id-ID")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
            <Info label="Nama Vendor" value={pr.vendor_nama ?? "—"} />
            <Info label="No. Telepon Vendor" value={pr.vendor_telepon ?? "—"} />
          </div>
          {pr.tujuan && <Info label="Tujuan" value={pr.tujuan} />}
          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t">
            <Info label="Estimasi Total" value={fmtRp(Number(pr.est_total))} />
            <Info label="Fee Koperasi (2%)" value={fmtRp(Number(pr.fee_nominal))} />
            <Info label="Total + Fee" value={fmtRp(Number(pr.est_total) + Number(pr.fee_nominal))} />
          </div>
          {pr.rejected_reason && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-xs">
              <strong>Alasan ditolak:</strong> {pr.rejected_reason}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Rincian Barang</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {(pr.school_pr_items ?? []).map((it: any) => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium">{it.nama_barang}</p>
                  <p className="text-xs text-muted-foreground">{it.qty} {it.satuan ?? "pcs"} × {fmtRp(Number(it.est_harga_satuan))}</p>
                </div>
                <span className="font-semibold">{fmtRp(Number(it.est_subtotal))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(pr.school_purchase_orders ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Purchase Order</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pr.school_purchase_orders.map((po: any) => (
              <div key={po.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{po.school_vendors?.nama}</p>
                    <p className="text-xs text-muted-foreground font-mono">{po.nomor_po ?? "—"}</p>
                  </div>
                  <span className="font-semibold">{fmtRp(Number(po.total_nilai))}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(pr.school_pr_payments ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Pembayaran</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pr.school_pr_payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{p.tipe === "to_vendor" ? "Bayar Vendor" : "Fee Koperasi 2%"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID")} · {p.metode ?? "—"}</p>
                </div>
                <span className="font-semibold">{fmtRp(Number(p.nominal))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Riwayat Status</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {audit.map((a: any) => {
              const Icon = a.to_status === "rejected" ? XCircle : CheckCircle2;
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 ${a.to_status === "rejected" ? "text-destructive" : "text-emerald-600"}`} />
                  <div>
                    <p className="font-medium">{STATUS_LABEL[a.to_status] ?? a.to_status}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
