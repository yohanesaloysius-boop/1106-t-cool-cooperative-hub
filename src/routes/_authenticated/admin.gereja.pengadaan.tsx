import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CheckCircle2, XCircle, Building2, Store, Send, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/gereja/pengadaan")({
  head: () => ({ meta: [{ title: "Admin Belanja Gereja — T-COOL" }] }),
  component: AdminPengadaanPage,
});

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Menunggu Keuangan", approved_finance: "Menunggu Ketua",
  approved_ketua: "Siap Diteruskan", forwarded_to_koperasi: "Di Koperasi",
  vendor_selected: "Vendor Dipilih", po_issued: "PO Terbit",
  paid_vendor: "Vendor Dibayar", fee_paid: "Fee Diterima", received: "Diterima",
  closed: "Selesai", rejected: "Ditolak", cancelled: "Dibatalkan",
};

function AdminPengadaanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Belanja Gereja</h1>
        <p className="text-sm text-muted-foreground">Kelola permintaan pembelian dari divisi gereja.</p>
      </div>

      <Tabs defaultValue="keuangan">
        <TabsList className="flex-wrap">
          <TabsTrigger value="keuangan">Approval Keuangan</TabsTrigger>
          <TabsTrigger value="ketua">Approval Ketua</TabsTrigger>
          <TabsTrigger value="koperasi">Di Koperasi</TabsTrigger>
          <TabsTrigger value="semua">Semua PR</TabsTrigger>
          <TabsTrigger value="vendor">Master Vendor</TabsTrigger>
          <TabsTrigger value="divisi">Master Divisi</TabsTrigger>
        </TabsList>

        <TabsContent value="keuangan" className="mt-4"><PRListByStatus statuses={["submitted"]} action="keuangan" /></TabsContent>
        <TabsContent value="ketua" className="mt-4"><PRListByStatus statuses={["approved_finance"]} action="ketua" /></TabsContent>
        <TabsContent value="koperasi" className="mt-4">
          <PRListByStatus statuses={["approved_ketua","forwarded_to_koperasi","vendor_selected","po_issued","paid_vendor","fee_paid"]} action="koperasi" />
        </TabsContent>
        <TabsContent value="semua" className="mt-4"><PRListByStatus statuses={[]} action="view" /></TabsContent>
        <TabsContent value="vendor" className="mt-4"><VendorMaster /></TabsContent>
        <TabsContent value="divisi" className="mt-4"><DivisiMaster /></TabsContent>
      </Tabs>
    </div>
  );
}

function PRListByStatus({ statuses, action }: { statuses: string[]; action: "keuangan" | "ketua" | "koperasi" | "view" }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-church-pr", statuses.join(",")],
    queryFn: async () => {
      let q = supabase.from("church_purchase_requests" as any)
        .select("*, church_divisions(nama), profiles!church_purchase_requests_requester_id_fkey(nama_lengkap)")
        .order("created_at", { ascending: false });
      if (statuses.length) q = q.in("status", statuses as any);
      const { data, error } = await q;
      if (error) {
        // fallback without profile join (no FK relation declared)
        const { data: d2 } = await (statuses.length
          ? supabase.from("church_purchase_requests" as any).select("*, church_divisions(nama)").in("status", statuses as any).order("created_at", { ascending: false })
          : supabase.from("church_purchase_requests" as any).select("*, church_divisions(nama)").order("created_at", { ascending: false }));
        return (d2 ?? []) as any[];
      }
      return data as any[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Tidak ada permintaan.</p>;

  return (
    <div className="space-y-2">
      {data.map((pr) => (
        <PRRow key={pr.id} pr={pr} action={action} refresh={() => qc.invalidateQueries({ queryKey: ["admin-church-pr"] })} />
      ))}
    </div>
  );
}

function PRRow({ pr, action, refresh }: { pr: any; action: string; refresh: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const updateStatus = async (newStatus: string, extra: Record<string, any> = {}) => {
    setBusy(true);
    const { error } = await supabase.from("church_purchase_requests" as any).update({ status: newStatus, ...extra }).eq("id", pr.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Status diperbarui"); refresh(); }
  };

  const approveKeuangan = () => updateStatus("approved_finance", { approved_finance_by: user!.id });
  const approveKetua = () => updateStatus("approved_ketua", { approved_ketua_by: user!.id });
  const forward = () => updateStatus("forwarded_to_koperasi", { koperasi_handler_id: user!.id, forwarded_at: new Date().toISOString() });
  const reject = async () => {
    if (!reason.trim()) return toast.error("Isi alasan");
    await updateStatus("rejected", { rejected_reason: reason, rejected_by: user!.id, rejected_at: new Date().toISOString() });
    setRejectOpen(false); setReason("");
  };

  return (
    <div className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/gereja/pengadaan/$id" params={{ id: pr.id }} className="font-medium hover:underline">{pr.judul}</Link>
          <Badge variant="secondary">{STATUS_LABEL[pr.status] ?? pr.status}</Badge>
          {pr.urgensi === "mendesak" && <Badge className="bg-red-500/10 text-red-700">Mendesak</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="font-mono">{pr.nomor_pr}</span> · {pr.church_divisions?.nama ?? "—"} · {new Date(pr.created_at).toLocaleDateString("id-ID")}
        </p>
        {(pr.vendor_nama || pr.vendor_telepon) && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Vendor: {pr.vendor_nama ?? "—"}{pr.vendor_telepon ? ` · ${pr.vendor_telepon}` : ""}
          </p>
        )}
        <p className="text-sm mt-1">{fmtRp(Number(pr.est_total))} <span className="text-muted-foreground">(fee {fmtRp(Number(pr.fee_nominal))})</span></p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {action === "keuangan" && (
          <>
            <Button size="sm" onClick={approveKeuangan} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Setujui</Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}><XCircle className="h-4 w-4" /> Tolak</Button>
          </>
        )}
        {action === "ketua" && (
          <>
            <Button size="sm" onClick={approveKetua} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Setujui Ketua</Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}><XCircle className="h-4 w-4" /> Tolak</Button>
          </>
        )}
        {action === "koperasi" && (
          <KoperasiActions pr={pr} onForward={forward} refresh={refresh} />
        )}
        <Button size="sm" variant="outline" asChild><Link to="/gereja/pengadaan/$id" params={{ id: pr.id }}>Detail</Link></Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tolak PR</DialogTitle></DialogHeader>
          <Textarea placeholder="Alasan penolakan" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={reject}>Tolak</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KoperasiActions({ pr, onForward, refresh }: { pr: any; onForward: () => void; refresh: () => void }) {
  const [poOpen, setPoOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  if (pr.status === "approved_ketua") {
    return <Button size="sm" onClick={onForward}><Send className="h-4 w-4" /> Teruskan ke Koperasi</Button>;
  }
  if (pr.status === "forwarded_to_koperasi") {
    return (
      <>
        <Dialog open={poOpen} onOpenChange={setPoOpen}>
          <DialogTrigger asChild><Button size="sm"><Store className="h-4 w-4" /> Pilih Vendor & Terbitkan PO</Button></DialogTrigger>
          <POForm prId={pr.id} estTotal={Number(pr.est_total)} onDone={() => { setPoOpen(false); refresh(); }} />
        </Dialog>
      </>
    );
  }
  if (["vendor_selected","po_issued","paid_vendor"].includes(pr.status)) {
    return (
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogTrigger asChild><Button size="sm"><Receipt className="h-4 w-4" /> Catat Pembayaran</Button></DialogTrigger>
        <PaymentForm pr={pr} onDone={() => { setPayOpen(false); refresh(); }} />
      </Dialog>
    );
  }
  if (pr.status === "fee_paid") {
    return <Button size="sm" onClick={async () => {
      const { error } = await supabase.from("church_purchase_requests" as any).update({ status: "received" }).eq("id", pr.id);
      if (error) toast.error(error.message); else { toast.success("Ditandai diterima"); refresh(); }
    }}><CheckCircle2 className="h-4 w-4" /> Tandai Diterima</Button>;
  }
  return null;
}

function POForm({ prId, estTotal, onDone }: { prId: string; estTotal: number; onDone: () => void }) {
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState("");
  const [total, setTotal] = useState(estTotal);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: vendors } = useQuery({
    queryKey: ["church-vendors-active"],
    queryFn: async () => {
      const { data } = await supabase.from("church_vendors" as any).select("id,nama,kategori").eq("is_active", true).order("nama");
      return (data ?? []) as any[];
    },
  });

  const save = async () => {
    if (!vendorId) return toast.error("Pilih vendor");
    setBusy(true);
    const yr = new Date().getFullYear();
    const nomor = `PO-G-${yr}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { error } = await supabase.from("church_purchase_orders" as any).insert({
      pr_id: prId, vendor_id: vendorId, nomor_po: nomor, total_nilai: total, catatan, created_by: user!.id,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("church_purchase_requests" as any).update({ status: "po_issued" }).eq("id", prId);
    toast.success(`PO ${nomor} dibuat`);
    setBusy(false); onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Pilih Vendor & Terbitkan PO</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Vendor</Label>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger><SelectValue placeholder="Pilih vendor" /></SelectTrigger>
            <SelectContent>
              {vendors?.map((v) => <SelectItem key={v.id} value={v.id}>{v.nama} {v.kategori ? `· ${v.kategori}` : ""}</SelectItem>)}
              {!vendors?.length && <SelectItem value="_" disabled>Belum ada vendor — tambah di Master Vendor</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Total Nilai PO</Label>
          <Input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
        </div>
        <div>
          <Label>Catatan</Label>
          <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={busy}>Terbitkan PO</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PaymentForm({ pr, onDone }: { pr: any; onDone: () => void }) {
  const { user } = useAuth();
  const hasVendorPay = (pr.church_pr_payments ?? []).some((p: any) => p.tipe === "to_vendor");
  const defaultTipe = hasVendorPay ? "fee_koperasi" : "to_vendor";
  const [tipe, setTipe] = useState<"to_vendor" | "fee_koperasi">(defaultTipe);
  const [nominal, setNominal] = useState(tipe === "fee_koperasi" ? Number(pr.fee_nominal) : Number(pr.est_total));
  const [metode, setMetode] = useState("transfer");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("church_pr_payments" as any).insert({
      pr_id: pr.id, tipe, nominal, metode, created_by: user!.id, verified_by: user!.id, verified_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    const nextStatus = tipe === "to_vendor" ? "paid_vendor" : "fee_paid";
    await supabase.from("church_purchase_requests" as any).update({ status: nextStatus }).eq("id", pr.id);
    toast.success("Pembayaran dicatat");
    setBusy(false); onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Tipe</Label>
          <Select value={tipe} onValueChange={(v: any) => { setTipe(v); setNominal(v === "fee_koperasi" ? Number(pr.fee_nominal) : Number(pr.est_total)); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="to_vendor">Pembayaran ke Vendor</SelectItem>
              <SelectItem value="fee_koperasi">Fee Koperasi 2%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nominal</Label>
          <Input type="number" value={nominal} onChange={(e) => setNominal(Number(e.target.value))} />
        </div>
        <div>
          <Label>Metode</Label>
          <Input value={metode} onChange={(e) => setMetode(e.target.value)} />
        </div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}

function VendorMaster() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["church-vendors-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("church_vendors" as any).select("*").order("nama");
      return (data ?? []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4 text-primary" /> Master Vendor</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Tambah Vendor</Button></DialogTrigger>
          <VendorForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["church-vendors-admin"] }); qc.invalidateQueries({ queryKey: ["church-vendors-active"] }); }} />
        </Dialog>
      </CardHeader>
      <CardContent>
        {!data?.length ? <p className="text-sm text-muted-foreground">Belum ada vendor.</p> : (
          <div className="space-y-1">
            {data.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium">{v.nama}</p>
                  <p className="text-xs text-muted-foreground">{v.kategori ?? "—"} · {v.telepon ?? "—"}</p>
                </div>
                <Badge variant={v.is_active ? "secondary" : "outline"}>{v.is_active ? "Aktif" : "Nonaktif"}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VendorForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ nama: "", kategori: "", telepon: "", email: "", alamat: "", bank_nama: "", bank_no_rek: "", bank_atas_nama: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.nama.trim()) return toast.error("Nama wajib");
    setBusy(true);
    const { error } = await supabase.from("church_vendors" as any).insert({ ...f, created_by: user!.id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Vendor ditambah"); onDone(); }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Tambah Vendor</DialogTitle></DialogHeader>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><Label>Nama Vendor</Label><Input value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></div>
        <div><Label>Kategori</Label><Input value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })} placeholder="mis. elektronik" /></div>
        <div><Label>Telepon</Label><Input value={f.telepon} onChange={(e) => setF({ ...f, telepon: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Bank</Label><Input value={f.bank_nama} onChange={(e) => setF({ ...f, bank_nama: e.target.value })} /></div>
        <div><Label>No. Rekening</Label><Input value={f.bank_no_rek} onChange={(e) => setF({ ...f, bank_no_rek: e.target.value })} /></div>
        <div><Label>Atas Nama</Label><Input value={f.bank_atas_nama} onChange={(e) => setF({ ...f, bank_atas_nama: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Alamat</Label><Textarea value={f.alamat} onChange={(e) => setF({ ...f, alamat: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}

function DivisiMaster() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["church-divisi-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("church_divisions" as any).select("*").order("nama");
      return (data ?? []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Master Divisi</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Tambah Divisi</Button></DialogTrigger>
          <DivisiForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["church-divisi-admin"] }); qc.invalidateQueries({ queryKey: ["church-divisions-active"] }); }} />
        </Dialog>
      </CardHeader>
      <CardContent>
        {!data?.length ? <p className="text-sm text-muted-foreground">Belum ada divisi.</p> : (
          <div className="space-y-1">
            {data.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium">{d.nama}</p>
                  <p className="text-xs text-muted-foreground">{d.kontak ?? "—"}</p>
                </div>
                <Badge variant={d.is_active ? "secondary" : "outline"}>{d.is_active ? "Aktif" : "Nonaktif"}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DivisiForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ nama: "", deskripsi: "", kontak: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.nama.trim()) return toast.error("Nama wajib");
    setBusy(true);
    const { error } = await supabase.from("church_divisions" as any).insert(f);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Divisi ditambah"); onDone(); }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Tambah Divisi</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nama Divisi</Label><Input value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Pelayanan Musik" /></div>
        <div><Label>Kontak PIC</Label><Input value={f.kontak} onChange={(e) => setF({ ...f, kontak: e.target.value })} /></div>
        <div><Label>Deskripsi</Label><Textarea value={f.deskripsi} onChange={(e) => setF({ ...f, deskripsi: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}
