import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Package, Plus, Trash2, RefreshCw, Calculator, MapPin, Car, Building2, Wrench, MonitorSmartphone, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/aset")({
  head: () => ({ meta: [{ title: "Aset & Inventaris — T-COOL Admin" }] }),
  component: AdminAsetPage,
});

type AssetRow = {
  id: string;
  nomor_aset: string;
  nama: string;
  kategori: "kendaraan" | "properti" | "peralatan" | "elektronik" | "lainnya";
  deskripsi: string | null;
  tanggal_perolehan: string;
  harga_perolehan: number;
  umur_ekonomis_bulan: number;
  nilai_residu: number;
  lokasi: string | null;
  kondisi: "baik" | "perlu_perbaikan" | "rusak";
  status: "aktif" | "dijual" | "rusak" | "dihapus";
  catatan: string | null;
  foto_url: string | null;
  dokumen_url: string | null;
  created_at: string;
};

const KATEGORI_ICON = {
  kendaraan: Car,
  properti: Building2,
  peralatan: Wrench,
  elektronik: MonitorSmartphone,
  lainnya: Package,
} as const;

const STATUS_BADGE: Record<string, string> = {
  aktif: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  dijual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rusak: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  dihapus: "bg-muted text-muted-foreground",
};

const KONDISI_BADGE: Record<string, string> = {
  baik: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  perlu_perbaikan: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  rusak: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

const fmtRp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

function bookValue(a: AssetRow): { akumulasi: number; nilaiBuku: number; bulanJalan: number } {
  const start = new Date(a.tanggal_perolehan);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  const beban = a.umur_ekonomis_bulan > 0 ? (a.harga_perolehan - a.nilai_residu) / a.umur_ekonomis_bulan : 0;
  const maxAkum = Math.max(0, a.harga_perolehan - a.nilai_residu);
  const akumulasi = Math.min(beban * months, maxAkum);
  return { akumulasi, nilaiBuku: a.harga_perolehan - akumulasi, bulanJalan: months };
}

function AdminAsetPage() {
  const qc = useQueryClient();
  const [filterKategori, setFilterKategori] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [detailAsset, setDetailAsset] = useState<AssetRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets" as never)
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssetRow[];
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((a) =>
      (filterKategori === "all" || a.kategori === filterKategori) &&
      (filterStatus === "all" || a.status === filterStatus)
    );
  }, [data, filterKategori, filterStatus]);

  const totals = useMemo(() => {
    const list = data ?? [];
    const totalPerolehan = list.reduce((s, a) => s + Number(a.harga_perolehan), 0);
    const totalBuku = list.reduce((s, a) => s + bookValue(a).nilaiBuku, 0);
    const aktif = list.filter((a) => a.status === "aktif").length;
    return { jumlah: list.length, aktif, totalPerolehan, totalBuku };
  }, [data]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assets" as never)
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aset dihapus");
      qc.invalidateQueries({ queryKey: ["admin-assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recompute = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("compute_asset_depreciation" as never, { _asset_id: id } as never);
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: (n) => {
      toast.success(`Penyusutan dihitung ulang (${n} bulan)`);
      qc.invalidateQueries({ queryKey: ["admin-assets"] });
      qc.invalidateQueries({ queryKey: ["asset-depreciations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#393232]">
          <Package className="h-4 w-4" /> Aset & Inventaris
        </div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold text-[#2c2626]">Manajemen Aset Koperasi</h1>
        <p className="mt-1 text-sm opacity-90 text-[#272121]">Catat kendaraan, properti, dan peralatan koperasi beserta penyusutannya.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Jumlah Aset" value={String(totals.jumlah)} hint={`${totals.aktif} aktif`} />
        <StatBox label="Nilai Perolehan" value={fmtRp(totals.totalPerolehan)} hint="Total harga beli" />
        <StatBox label="Nilai Buku" value={fmtRp(totals.totalBuku)} hint="Setelah penyusutan" />
        <StatBox label="Penyusutan" value={fmtRp(totals.totalPerolehan - totals.totalBuku)} hint="Akumulasi sd. bulan ini" />
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Daftar Aset</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterKategori} onValueChange={setFilterKategori}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                <SelectItem value="kendaraan">Kendaraan</SelectItem>
                <SelectItem value="properti">Properti</SelectItem>
                <SelectItem value="peralatan">Peralatan</SelectItem>
                <SelectItem value="elektronik">Elektronik</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="dijual">Dijual</SelectItem>
                <SelectItem value="rusak">Rusak</SelectItem>
                <SelectItem value="dihapus">Dihapus</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}>
                  <Plus className="h-4 w-4" /> Tambah Aset
                </Button>
              </DialogTrigger>
              <AssetFormDialog editing={editing} onDone={() => { setOpenForm(false); setEditing(null); }} />
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Package} title="Belum ada aset" desc="Tambahkan aset koperasi untuk mulai mencatat penyusutan." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((a) => {
                const Icon = KATEGORI_ICON[a.kategori] ?? Package;
                const bv = bookValue(a);
                return (
                  <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                        <div>
                          <div className="font-semibold leading-tight">{a.nama}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">#{a.nomor_aset} · {a.kategori}</div>
                          {a.lokasi && <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{a.lokasi}</div>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={STATUS_BADGE[a.status]}>{a.status}</Badge>
                        <Badge variant="outline" className={KONDISI_BADGE[a.kondisi]}>{a.kondisi.replace("_", " ")}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-muted-foreground">Perolehan</div>
                        <div className="font-semibold">{fmtRp(a.harga_perolehan)}</div>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-muted-foreground">Nilai Buku</div>
                        <div className="font-semibold">{fmtRp(bv.nilaiBuku)}</div>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-muted-foreground">Akum. Penyusutan</div>
                        <div className="font-semibold">{fmtRp(bv.akumulasi)}</div>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-muted-foreground">Umur Berjalan</div>
                        <div className="font-semibold">{bv.bulanJalan} / {a.umur_ekonomis_bulan} bln</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setDetailAsset(a)}>Detail</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(a); setOpenForm(true); }}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => recompute.mutate(a.id)} disabled={recompute.isPending}>
                        <RefreshCw className={`h-3.5 w-3.5 ${recompute.isPending ? "animate-spin" : ""}`} /> Hitung Penyusutan
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Hapus aset ini?")) remove.mutate(a.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detailAsset} onOpenChange={(v) => !v && setDetailAsset(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{detailAsset?.nama}</SheetTitle></SheetHeader>
          {detailAsset && <AssetDetail asset={detailAsset} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={{ boxShadow: "var(--shadow-card)" }}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-bold">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function AssetFormDialog({ editing, onDone }: { editing: AssetRow | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nomor_aset: editing?.nomor_aset ?? "",
    nama: editing?.nama ?? "",
    kategori: editing?.kategori ?? "lainnya",
    deskripsi: editing?.deskripsi ?? "",
    tanggal_perolehan: editing?.tanggal_perolehan ?? new Date().toISOString().slice(0, 10),
    harga_perolehan: editing?.harga_perolehan?.toString() ?? "0",
    umur_ekonomis_bulan: editing?.umur_ekonomis_bulan?.toString() ?? "60",
    nilai_residu: editing?.nilai_residu?.toString() ?? "0",
    lokasi: editing?.lokasi ?? "",
    kondisi: editing?.kondisi ?? "baik",
    status: editing?.status ?? "aktif",
    catatan: editing?.catatan ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nomor_aset: form.nomor_aset.trim(),
        nama: form.nama.trim(),
        kategori: form.kategori,
        deskripsi: form.deskripsi || null,
        tanggal_perolehan: form.tanggal_perolehan,
        harga_perolehan: Number(form.harga_perolehan) || 0,
        umur_ekonomis_bulan: Math.max(1, Number(form.umur_ekonomis_bulan) || 1),
        nilai_residu: Number(form.nilai_residu) || 0,
        lokasi: form.lokasi || null,
        kondisi: form.kondisi,
        status: form.status,
        catatan: form.catatan || null,
      };
      if (!payload.nomor_aset || !payload.nama) throw new Error("Nomor aset & nama wajib diisi");
      if (editing) {
        const { error } = await supabase.from("assets" as never).update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets" as never).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Aset diperbarui" : "Aset ditambahkan");
      qc.invalidateQueries({ queryKey: ["admin-assets"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Edit Aset" : "Tambah Aset"}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nomor Aset *</Label><Input value={form.nomor_aset} onChange={(e) => setForm({ ...form, nomor_aset: e.target.value })} placeholder="AST-001" /></div>
          <div>
            <Label>Kategori</Label>
            <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v as typeof form.kategori })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kendaraan">Kendaraan</SelectItem>
                <SelectItem value="properti">Properti</SelectItem>
                <SelectItem value="peralatan">Peralatan</SelectItem>
                <SelectItem value="elektronik">Elektronik</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Nama Aset *</Label><Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Motor Honda Beat 2023" /></div>
        <div><Label>Deskripsi</Label><Textarea rows={2} value={form.deskripsi ?? ""} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tanggal Perolehan</Label><Input type="date" value={form.tanggal_perolehan} onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })} /></div>
          <div><Label>Lokasi</Label><Input value={form.lokasi ?? ""} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Harga (Rp)</Label><Input type="number" value={form.harga_perolehan} onChange={(e) => setForm({ ...form, harga_perolehan: e.target.value })} /></div>
          <div><Label>Umur (bulan)</Label><Input type="number" value={form.umur_ekonomis_bulan} onChange={(e) => setForm({ ...form, umur_ekonomis_bulan: e.target.value })} /></div>
          <div><Label>Nilai Residu</Label><Input type="number" value={form.nilai_residu} onChange={(e) => setForm({ ...form, nilai_residu: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kondisi</Label>
            <Select value={form.kondisi} onValueChange={(v) => setForm({ ...form, kondisi: v as typeof form.kondisi })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baik">Baik</SelectItem>
                <SelectItem value="perlu_perbaikan">Perlu Perbaikan</SelectItem>
                <SelectItem value="rusak">Rusak</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="dijual">Dijual</SelectItem>
                <SelectItem value="rusak">Rusak</SelectItem>
                <SelectItem value="dihapus">Dihapus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Catatan</Label><Textarea rows={2} value={form.catatan ?? ""} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Simpan Perubahan" : "Tambah Aset"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AssetDetail({ asset }: { asset: AssetRow }) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["asset-depreciations", asset.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_depreciations" as never)
        .select("*")
        .eq("asset_id", asset.id)
        .order("periode", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Array<{ periode: string; beban_bulan: number; akumulasi: number; nilai_buku: number }>;
    },
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Nomor</div><div className="font-semibold">{asset.nomor_aset}</div></div>
        <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Kategori</div><div className="font-semibold capitalize">{asset.kategori}</div></div>
        <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Perolehan</div><div className="font-semibold">{fmtRp(asset.harga_perolehan)}</div></div>
        <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Residu</div><div className="font-semibold">{fmtRp(asset.nilai_residu)}</div></div>
        <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Umur Ekonomis</div><div className="font-semibold">{asset.umur_ekonomis_bulan} bulan</div></div>
        <div className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">Tgl Perolehan</div><div className="font-semibold">{new Date(asset.tanggal_perolehan).toLocaleDateString("id-ID")}</div></div>
      </div>
      {asset.deskripsi && <div className="rounded-md border border-border p-3 text-sm"><div className="text-xs text-muted-foreground">Deskripsi</div>{asset.deskripsi}</div>}
      {asset.catatan && <div className="rounded-md border border-border p-3 text-sm"><div className="text-xs text-muted-foreground">Catatan</div>{asset.catatan}</div>}

      <Tabs defaultValue="dep">
        <TabsList><TabsTrigger value="dep"><Calculator className="h-3.5 w-3.5 mr-1" />Riwayat Penyusutan</TabsTrigger></TabsList>
        <TabsContent value="dep" className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
          ) : !rows || rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Belum ada riwayat penyusutan. Klik <b>Hitung Penyusutan</b> pada kartu aset untuk menghasilkan.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr><th className="p-2 text-left">Periode</th><th className="p-2 text-right">Beban</th><th className="p-2 text-right">Akumulasi</th><th className="p-2 text-right">Nilai Buku</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.periode} className="border-t border-border">
                      <td className="p-2">{new Date(r.periode).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}</td>
                      <td className="p-2 text-right">{fmtRp(r.beban_bulan)}</td>
                      <td className="p-2 text-right">{fmtRp(r.akumulasi)}</td>
                      <td className="p-2 text-right font-semibold">{fmtRp(r.nilai_buku)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
