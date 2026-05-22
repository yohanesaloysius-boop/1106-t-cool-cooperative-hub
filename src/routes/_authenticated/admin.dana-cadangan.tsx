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
import { toast } from "sonner";
import { PiggyBank, ArrowUpRight, ArrowDownLeft, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dana-cadangan")({
  head: () => ({ meta: [{ title: "Dana Cadangan & Sosial — Admin" }] }),
  component: DanaCadanganPage,
});

const fmt = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

function DanaCadanganPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fund_id: "", tipe: "setor", nominal: "", sumber: "manual", catatan: "" });

  const { data: funds } = useQuery({
    queryKey: ["reserve-funds"],
    queryFn: async () => {
      const { data } = await supabase.from("reserve_funds").select("*").order("jenis");
      return data ?? [];
    },
  });

  const { data: moves } = useQuery({
    queryKey: ["reserve-moves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reserve_fund_movements")
        .select("*, reserve_funds!inner(nama,jenis)")
        .order("tanggal", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.fund_id || !form.nominal) throw new Error("Lengkapi form");
      const { error } = await supabase.from("reserve_fund_movements").insert({
        fund_id: form.fund_id,
        tipe: form.tipe as "setor" | "tarik",
        nominal: Number(form.nominal),
        sumber: form.sumber,
        catatan: form.catatan || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mutasi tercatat");
      setOpen(false);
      setForm({ fund_id: "", tipe: "setor", nominal: "", sumber: "manual", catatan: "" });
      qc.invalidateQueries({ queryKey: ["reserve-funds"] });
      qc.invalidateQueries({ queryKey: ["reserve-moves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dana Cadangan & Sosial</h1>
          <p className="text-sm text-muted-foreground">Kelola dana cadangan, sosial, dan pendidikan koperasi.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />Mutasi Baru</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Catat Mutasi Dana</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Dana</Label>
                <Select value={form.fund_id} onValueChange={(v) => setForm({ ...form, fund_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih dana" /></SelectTrigger>
                  <SelectContent>
                    {funds?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipe</Label>
                <Select value={form.tipe} onValueChange={(v) => setForm({ ...form, tipe: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setor">Setor (masuk)</SelectItem>
                    <SelectItem value="tarik">Tarik (keluar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nominal</Label>
                <Input type="number" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} />
              </div>
              <div>
                <Label>Sumber</Label>
                <Input value={form.sumber} onChange={(e) => setForm({ ...form, sumber: e.target.value })} placeholder="manual / shu / donasi" />
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
              </div>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {funds?.map((f) => (
          <Card key={f.id} style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PiggyBank className="h-4 w-4 text-primary" /> {f.nama}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(Number(f.saldo))}</p>
              <p className="text-xs text-muted-foreground mt-1">{f.deskripsi}</p>
              <Badge variant="outline" className="mt-2">{f.persen_dari_shu}% dari SHU</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Riwayat Mutasi</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Dana</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moves?.length ? moves.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.tanggal}</TableCell>
                  <TableCell>{m.reserve_funds?.nama}</TableCell>
                  <TableCell>
                    {m.tipe === "setor" ? (
                      <Badge className="bg-green-100 text-green-800"><ArrowUpRight className="h-3 w-3" />Setor</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800"><ArrowDownLeft className="h-3 w-3" />Tarik</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(m.nominal))}</TableCell>
                  <TableCell><Badge variant="outline">{m.sumber}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.catatan}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada mutasi</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
