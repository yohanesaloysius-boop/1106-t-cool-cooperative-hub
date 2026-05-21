import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Plus, Receipt, Check, X, Wallet, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/opex")({
  head: () => ({ meta: [{ title: "OPEX — T-COOL Admin" }] }),
  component: AdminOpexPage,
});

type Cat = {
  id: string;
  kode: string;
  nama: string;
  pajak_jenis: string | null;
  pajak_tarif: number;
};

type Opex = {
  id: string;
  nomor_bukti: string | null;
  category_id: string;
  tanggal: string;
  deskripsi: string;
  nominal: number;
  penerima: string | null;
  metode_bayar: "tunai" | "transfer" | "wallet" | "lainnya";
  status: "draft" | "pending" | "approved" | "rejected" | "paid" | "cancelled";
  pajak_nominal: number;
  catatan: string | null;
  rejected_reason: string | null;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
  opex_categories?: { nama: string; kode: string } | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

function AdminOpexPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [openForm, setOpenForm] = useState(false);
  const canApprove = roles.some((r) => ["super_admin", "ketua"].includes(r));
  const canPay = roles.some((r) => ["super_admin", "bendahara"].includes(r));

  const cats = useQuery({
    queryKey: ["opex_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("opex_categories").select("*").order("nama");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const list = useQuery({
    queryKey: ["opex_expenses", tab],
    queryFn: async () => {
      let q = supabase.from("opex_expenses").select("*, opex_categories(nama,kode)").is("deleted_at", null).order("tanggal", { ascending: false }).limit(500);
      if (tab !== "all") q = q.eq("status", tab as Opex["status"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Opex[];
    },
  });

  const summary = useMemo(() => {
    const rows = list.data ?? [];
    const total = rows.reduce((s, r) => s + Number(r.nominal || 0), 0);
    const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.nominal || 0), 0);
    const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.nominal || 0), 0);
    const pajak = rows.reduce((s, r) => s + Number(r.pajak_nominal || 0), 0);
    return { total, paid, pending, pajak, count: rows.length };
  }, [list.data]);

  const create = useMutation({
    mutationFn: async (payload: {
      category_id: string;
      tanggal: string;
      deskripsi: string;
      nominal: number;
      penerima: string;
      metode_bayar: string;
      catatan: string;
      submit: boolean;
    }) => {
      const cat = cats.data?.find((c) => c.id === payload.category_id);
      const pajak_nominal = cat?.pajak_tarif ? Math.round((payload.nominal * Number(cat.pajak_tarif)) / 100) : 0;
      const { error } = await supabase.from("opex_expenses").insert({
        category_id: payload.category_id,
        tanggal: payload.tanggal,
        deskripsi: payload.deskripsi,
        nominal: payload.nominal,
        penerima: payload.penerima || null,
        metode_bayar: payload.metode_bayar as Opex["metode_bayar"],
        status: payload.submit ? "pending" : "draft",
        pajak_nominal,
        pajak_meta: cat?.pajak_jenis ? { jenis: cat.pajak_jenis, tarif: cat.pajak_tarif } : null,
        catatan: payload.catatan || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengajuan OPEX dibuat");
      qc.invalidateQueries({ queryKey: ["opex_expenses"] });
      setOpenForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: Opex["status"]; reason?: string }) => {
      type Patch = Parameters<ReturnType<typeof supabase.from<"opex_expenses">>["update"]>[0];
      const patch: Patch = { status: p.status, updated_by: user?.id ?? null };
      if (p.status === "approved") { patch.approved_by = user?.id ?? null; patch.approved_at = new Date().toISOString(); }
      if (p.status === "rejected") { patch.rejected_reason = p.reason ?? null; }
      if (p.status === "paid") { patch.paid_by = user?.id ?? null; patch.paid_at = new Date().toISOString(); }
      const { error } = await supabase.from("opex_expenses").update(patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status diperbarui");
      qc.invalidateQueries({ queryKey: ["opex_expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengeluaran Operasional (OPEX)</h1>
          <p className="text-sm text-muted-foreground">Gaji, sewa, listrik, ATK & beban operasional lain dengan workflow approval.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => list.refetch()} disabled={list.isFetching}>
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={openForm} onOpenChange={setOpenForm}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Pengajuan Baru</Button>
            </DialogTrigger>
            <OpexForm cats={cats.data ?? []} onSubmit={(p) => create.mutate(p)} pending={create.isPending} />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total Pengajuan" value={fmt(summary.total)} sub={`${summary.count} transaksi`} />
        <SummaryCard label="Terbayar" value={fmt(summary.paid)} sub="status: paid" tone="emerald" />
        <SummaryCard label="Menunggu Approval" value={fmt(summary.pending)} sub="status: pending" tone="amber" />
        <SummaryCard label="Total Pajak Dipotong" value={fmt(summary.pajak)} sub="PPh 21/23" tone="blue" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Disetujui</TabsTrigger>
          <TabsTrigger value="paid">Dibayar</TabsTrigger>
          <TabsTrigger value="rejected">Ditolak</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Pengeluaran</CardTitle></CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !list.data?.length ? (
            <EmptyState icon={Receipt} title="Belum ada data OPEX" description="Buat pengajuan pertama dengan tombol di atas." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Penerima</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="text-right">Pajak</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(r.tanggal).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.opex_categories?.nama ?? "—"}</Badge></TableCell>
                      <TableCell className="max-w-[260px]"><div className="truncate text-sm">{r.deskripsi}</div></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.penerima ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(r.nominal))}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{r.pajak_nominal ? fmt(Number(r.pajak_nominal)) : "—"}</TableCell>
                      <TableCell><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "pending" })}>Ajukan</Button>
                          )}
                          {r.status === "pending" && canApprove && (
                            <>
                              <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-rose-600" onClick={() => {
                                const reason = window.prompt("Alasan penolakan?") ?? "";
                                if (reason) setStatus.mutate({ id: r.id, status: "rejected", reason });
                              }}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {r.status === "approved" && canPay && (
                            <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: "paid" })}>
                              <Wallet className="h-3.5 w-3.5 mr-1" /> Tandai Bayar
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
    </div>
  );
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "amber" | "blue" }) {
  const toneCls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "blue" ? "text-blue-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-lg font-bold ${toneCls}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function OpexForm({ cats, onSubmit, pending }: { cats: Cat[]; onSubmit: (p: { category_id: string; tanggal: string; deskripsi: string; nominal: number; penerima: string; metode_bayar: string; catatan: string; submit: boolean }) => void; pending: boolean }) {
  const [category_id, setCategory] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [deskripsi, setDeskripsi] = useState("");
  const [nominal, setNominal] = useState<string>("");
  const [penerima, setPenerima] = useState("");
  const [metode_bayar, setMetode] = useState("transfer");
  const [catatan, setCatatan] = useState("");
  const cat = cats.find((c) => c.id === category_id);
  const nominalNum = Number(nominal || 0);
  const pajakPreview = cat?.pajak_tarif ? Math.round((nominalNum * Number(cat.pajak_tarif)) / 100) : 0;

  const submit = (sub: boolean) => {
    if (!category_id) return toast.error("Pilih kategori");
    if (!deskripsi.trim()) return toast.error("Deskripsi wajib diisi");
    if (nominalNum <= 0) return toast.error("Nominal harus > 0");
    onSubmit({ category_id, tanggal, deskripsi, nominal: nominalNum, penerima, metode_bayar, catatan, submit: sub });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Pengajuan OPEX</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kategori</Label>
            <Select value={category_id} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nama}{c.pajak_jenis ? ` (${c.pajak_jenis.toUpperCase()} ${c.pajak_tarif}%)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tanggal</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Deskripsi</Label>
          <Input value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Contoh: Gaji pengurus Mei 2026" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nominal (Rp)</Label>
            <Input type="number" inputMode="numeric" value={nominal} onChange={(e) => setNominal(e.target.value)} />
          </div>
          <div>
            <Label>Metode Bayar</Label>
            <Select value={metode_bayar} onValueChange={setMetode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="wallet">E-Wallet</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Penerima</Label>
          <Input value={penerima} onChange={(e) => setPenerima(e.target.value)} placeholder="Nama / vendor" />
        </div>
        <div>
          <Label>Catatan (opsional)</Label>
          <Textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </div>
        {pajakPreview > 0 && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            Pajak otomatis: <b>{fmt(pajakPreview)}</b> ({cat?.pajak_jenis?.toUpperCase()} {cat?.pajak_tarif}%)
          </div>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={pending} onClick={() => submit(false)}>Simpan Draft</Button>
        <Button disabled={pending} onClick={() => submit(true)}>
          {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Ajukan Approval
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
