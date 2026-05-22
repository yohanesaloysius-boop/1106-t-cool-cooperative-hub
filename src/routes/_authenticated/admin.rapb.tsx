import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Plus, Loader2, Trash2, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rapb")({
  head: () => ({ meta: [{ title: "RAPB — Admin" }] }),
  component: RapbPage,
});

const fmt = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

function RapbPage() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [openPlan, setOpenPlan] = useState(false);
  const [openItem, setOpenItem] = useState(false);
  const [planForm, setPlanForm] = useState({ tahun: new Date().getFullYear(), judul: "", catatan: "" });
  const [itemForm, setItemForm] = useState({ jenis: "pendapatan", kategori: "", sub_kategori: "", target_nominal: "" });

  const { data: plans } = useQuery({
    queryKey: ["budget-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("budget_plans" as any).select("*").order("tahun", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const activePlan = selectedPlan || plans?.[0]?.id || "";

  const { data: realisasi } = useQuery({
    queryKey: ["rapb-realisasi", activePlan],
    enabled: !!activePlan,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rapb_realisasi" as any, { _plan_id: activePlan });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      if (!planForm.judul) throw new Error("Judul wajib diisi");
      const { error } = await supabase.from("budget_plans" as any).insert(planForm as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RAPB dibuat");
      setOpenPlan(false);
      setPlanForm({ tahun: new Date().getFullYear(), judul: "", catatan: "" });
      qc.invalidateQueries({ queryKey: ["budget-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!activePlan || !itemForm.kategori || !itemForm.target_nominal) throw new Error("Lengkapi form");
      const { error } = await supabase.from("budget_items" as any).insert({
        plan_id: activePlan,
        jenis: itemForm.jenis,
        kategori: itemForm.kategori,
        sub_kategori: itemForm.sub_kategori || null,
        target_nominal: Number(itemForm.target_nominal),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item ditambahkan");
      setOpenItem(false);
      setItemForm({ jenis: "pendapatan", kategori: "", sub_kategori: "", target_nominal: "" });
      qc.invalidateQueries({ queryKey: ["rapb-realisasi", activePlan] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item dihapus");
      qc.invalidateQueries({ queryKey: ["rapb-realisasi", activePlan] });
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("budget_plans" as any).update({ status } as any).eq("id", activePlan);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status diperbarui");
      qc.invalidateQueries({ queryKey: ["budget-plans"] });
    },
  });

  const pendapatan = realisasi?.filter((r) => r.jenis === "pendapatan") ?? [];
  const beban = realisasi?.filter((r) => r.jenis === "beban") ?? [];
  const totalTargetPend = pendapatan.reduce((s, r) => s + Number(r.target_nominal), 0);
  const totalRealPend = pendapatan.reduce((s, r) => s + Number(r.realisasi), 0);
  const totalTargetBeb = beban.reduce((s, r) => s + Number(r.target_nominal), 0);
  const totalRealBeb = beban.reduce((s, r) => s + Number(r.realisasi), 0);
  const currentPlan = plans?.find((p) => p.id === activePlan);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">RAPB — Rencana Anggaran</h1>
          <p className="text-sm text-muted-foreground">Susun & monitor anggaran pendapatan dan belanja tahunan koperasi.</p>
        </div>
        <div className="flex gap-2">
          <Select value={activePlan} onValueChange={setSelectedPlan}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Pilih RAPB" /></SelectTrigger>
            <SelectContent>
              {plans?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.tahun} — {p.judul}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={openPlan} onOpenChange={setOpenPlan}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4" />RAPB Baru</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Buat RAPB Tahunan</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Tahun</Label><Input type="number" value={planForm.tahun} onChange={(e) => setPlanForm({ ...planForm, tahun: Number(e.target.value) })} /></div>
                <div><Label>Judul</Label><Input value={planForm.judul} onChange={(e) => setPlanForm({ ...planForm, judul: e.target.value })} placeholder="RAPB 2026" /></div>
                <div><Label>Catatan</Label><Textarea value={planForm.catatan} onChange={(e) => setPlanForm({ ...planForm, catatan: e.target.value })} /></div>
                <Button onClick={() => createPlan.mutate()} disabled={createPlan.isPending} className="w-full">
                  {createPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!activePlan ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          Belum ada RAPB. Buat RAPB tahunan untuk mulai monitoring anggaran.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" />Total Pendapatan</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{fmt(totalRealPend)}</p>
                <p className="text-xs text-muted-foreground">dari target {fmt(totalTargetPend)}</p>
                <Progress value={totalTargetPend ? Math.min(100, (totalRealPend / totalTargetPend) * 100) : 0} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
            <Card style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" />Total Beban</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{fmt(totalRealBeb)}</p>
                <p className="text-xs text-muted-foreground">dari plafon {fmt(totalTargetBeb)}</p>
                <Progress value={totalTargetBeb ? Math.min(100, (totalRealBeb / totalTargetBeb) * 100) : 0} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
            <Card style={{ boxShadow: "var(--shadow-card)" }}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Status & Aksi</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={currentPlan?.status === "disahkan" ? "default" : "outline"}>{currentPlan?.status}</Badge>
                <div className="flex gap-2">
                  {currentPlan?.status === "draft" && <Button size="sm" onClick={() => setStatus.mutate("disahkan")}>Sahkan</Button>}
                  {currentPlan?.status === "disahkan" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate("ditutup")}>Tutup</Button>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rincian Anggaran vs Realisasi</CardTitle>
              <Dialog open={openItem} onOpenChange={setOpenItem}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />Tambah Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Tambah Item Anggaran</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Jenis</Label>
                      <Select value={itemForm.jenis} onValueChange={(v) => setItemForm({ ...itemForm, jenis: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendapatan">Pendapatan</SelectItem>
                          <SelectItem value="beban">Beban</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Kategori</Label><Input value={itemForm.kategori} onChange={(e) => setItemForm({ ...itemForm, kategori: e.target.value })} placeholder="contoh: Jasa pinjaman / ATK" /></div>
                    <div><Label>Sub Kategori (opsional)</Label><Input value={itemForm.sub_kategori} onChange={(e) => setItemForm({ ...itemForm, sub_kategori: e.target.value })} /></div>
                    <div><Label>Target Nominal</Label><Input type="number" value={itemForm.target_nominal} onChange={(e) => setItemForm({ ...itemForm, target_nominal: e.target.value })} /></div>
                    <Button onClick={() => addItem.mutate()} disabled={addItem.isPending} className="w-full">
                      {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pendapatan">
                <TabsList>
                  <TabsTrigger value="pendapatan">Pendapatan ({pendapatan.length})</TabsTrigger>
                  <TabsTrigger value="beban">Beban ({beban.length})</TabsTrigger>
                </TabsList>
                {(["pendapatan", "beban"] as const).map((tab) => (
                  <TabsContent key={tab} value={tab}>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Realisasi</TableHead>
                        <TableHead className="w-[200px]">Capaian</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(tab === "pendapatan" ? pendapatan : beban).map((r) => (
                          <TableRow key={r.item_id}>
                            <TableCell>
                              <div className="font-medium">{r.kategori}</div>
                              {r.sub_kategori && <div className="text-xs text-muted-foreground">{r.sub_kategori}</div>}
                            </TableCell>
                            <TableCell className="text-right">{fmt(Number(r.target_nominal))}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(Number(r.realisasi))}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={Math.min(100, Number(r.persen))} className="h-1.5 flex-1" />
                                <span className="text-xs w-12 text-right">{Number(r.persen).toFixed(0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => delItem.mutate(r.item_id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(tab === "pendapatan" ? pendapatan : beban).length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada item</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
