import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Building2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gereja/pengadaan")({
  head: () => ({ meta: [{ title: "Pengadaan Gereja — T-COOL" }] }),
  component: PengadaanGerejaPage,
});

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-foreground" },
  submitted: { label: "Diajukan", color: "bg-blue-100 text-blue-700" },
  approved_finance: { label: "Disetujui Keuangan", color: "bg-cyan-100 text-cyan-700" },
  approved_ketua: { label: "Disetujui Ketua", color: "bg-indigo-100 text-indigo-700" },
  forwarded_to_koperasi: { label: "Di Koperasi", color: "bg-purple-100 text-purple-700" },
  vendor_selected: { label: "Vendor Dipilih", color: "bg-violet-100 text-violet-700" },
  po_issued: { label: "PO Terbit", color: "bg-fuchsia-100 text-fuchsia-700" },
  paid_vendor: { label: "Bayar Vendor", color: "bg-amber-100 text-amber-700" },
  fee_paid: { label: "Fee Dibayar", color: "bg-orange-100 text-orange-700" },
  received: { label: "Diterima", color: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Selesai", color: "bg-green-100 text-green-700" },
  rejected: { label: "Ditolak", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Dibatalkan", color: "bg-zinc-200 text-zinc-700" },
};

function PengadaanGerejaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: prs, isLoading } = useQuery({
    queryKey: ["my-church-pr", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("church_purchase_requests" as any)
        .select("*, church_divisions(nama)")
        .eq("requester_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengadaan Gereja</h1>
          <p className="text-sm text-muted-foreground">Ajukan kebutuhan barang/jasa divisi pelayanan.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Ajukan PR Baru</Button>
          </DialogTrigger>
          <NewPRDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-church-pr"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Daftar PR Saya</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : !prs?.length ? (
            <p className="text-sm text-muted-foreground">Belum ada permintaan pembelian. Klik "Ajukan PR Baru".</p>
          ) : (
            <div className="space-y-2">
              {prs.map((pr) => (
                <Link key={pr.id} to="/gereja/pengadaan/$id" params={{ id: pr.id }} className="block">
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{pr.judul}</span>
                        <Badge className={STATUS_LABEL[pr.status]?.color}>{STATUS_LABEL[pr.status]?.label ?? pr.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{pr.nomor_pr}</span>
                        <span>·</span>
                        <Building2 className="h-3 w-3" />
                        <span>{pr.church_divisions?.nama ?? "—"}</span>
                        <span>·</span>
                        <span>{new Date(pr.created_at).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{fmtRp(Number(pr.est_total))}</div>
                      <div className="text-[11px] text-muted-foreground">Fee 2%: {fmtRp(Number(pr.fee_nominal))}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewPRDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [judul, setJudul] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [urgensi, setUrgensi] = useState("normal");
  const [vendorNama, setVendorNama] = useState("");
  const [vendorTelepon, setVendorTelepon] = useState("");
  const [items, setItems] = useState<{ nama: string; qty: number; harga: number }[]>([{ nama: "", qty: 1, harga: 0 }]);
  const [saving, setSaving] = useState(false);

  const { data: divisions } = useQuery({
    queryKey: ["church-divisions-active"],
    queryFn: async () => {
      const { data } = await supabase.from("church_divisions" as any).select("id,nama").eq("is_active", true).order("nama");
      return (data ?? []) as any[];
    },
  });

  const total = items.reduce((s, i) => s + i.qty * i.harga, 0);

  const submit = async (asDraft: boolean) => {
    if (!judul.trim() || !divisionId) return toast.error("Lengkapi judul & divisi");
    if (!items.length || items.some((i) => !i.nama.trim())) return toast.error("Lengkapi nama barang");
    setSaving(true);
    try {
      const { data: pr, error } = await supabase.from("church_purchase_requests" as any).insert({
        division_id: divisionId,
        requester_id: user!.id,
        judul, tujuan, urgensi,
        vendor_nama: vendorNama || null,
        vendor_telepon: vendorTelepon || null,
        est_total: total,
        status: asDraft ? "draft" : "submitted",
      }).select().single();
      if (error) throw error;
      const itemRows = items.map((i) => ({
        pr_id: (pr as any).id,
        nama_barang: i.nama,
        qty: i.qty,
        est_harga_satuan: i.harga,
        est_subtotal: i.qty * i.harga,
      }));
      const { error: e2 } = await supabase.from("church_pr_items" as any).insert(itemRows);
      if (e2) throw e2;
      toast.success(asDraft ? "Draft tersimpan" : "PR diajukan ke keuangan");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Permintaan Pembelian Baru</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Divisi/Pelayanan</Label>
            <Select value={divisionId} onValueChange={setDivisionId}>
              <SelectTrigger><SelectValue placeholder="Pilih divisi" /></SelectTrigger>
              <SelectContent>
                {divisions?.map((d) => <SelectItem key={d.id} value={d.id}>{d.nama}</SelectItem>)}
                {!divisions?.length && <SelectItem value="_" disabled>Belum ada divisi (minta pengurus)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Urgensi</Label>
            <Select value={urgensi} onValueChange={setUrgensi}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rendah">Rendah</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="tinggi">Tinggi</SelectItem>
                <SelectItem value="mendesak">Mendesak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Judul</Label>
          <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Mis. Pembelian sound system" />
        </div>
        <div>
          <Label>Tujuan / Keterangan</Label>
          <Textarea value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="Untuk kegiatan apa & kapan dibutuhkan" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Rincian Barang</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, { nama: "", qty: 1, harga: 0 }])}>
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Input placeholder="Nama barang" value={it.nama} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, nama: e.target.value } : x))} />
                </div>
                <div className="col-span-2">
                  <Input type="number" min={1} placeholder="Qty" value={it.qty} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} />
                </div>
                <div className="col-span-4">
                  <Input type="number" min={0} placeholder="Harga satuan" value={it.harga} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, harga: Number(e.target.value) } : x))} />
                </div>
                <div className="col-span-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} disabled={items.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">Estimasi total:</span>
            <span className="font-semibold">{fmtRp(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Fee jasa koperasi 2% akan dihitung otomatis saat disetujui keuangan.</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => submit(true)} disabled={saving}>Simpan Draft</Button>
        <Button onClick={() => submit(false)} disabled={saving}>Ajukan ke Keuangan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
