import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Ticket, Trash2, Loader2, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/kupon")({
  head: () => ({ meta: [{ title: "Kupon Marketplace — Admin" }] }),
  component: KuponPage,
});

const fmt = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

type FormState = {
  code: string;
  deskripsi: string;
  tipe: "percent" | "fixed";
  nilai: string;
  min_belanja: string;
  max_diskon: string;
  kuota: string;
  berlaku_sampai: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  code: "",
  deskripsi: "",
  tipe: "percent",
  nilai: "10",
  min_belanja: "0",
  max_diskon: "",
  kuota: "",
  berlaku_sampai: "",
  is_active: true,
};

function KuponPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.nilai) throw new Error("Code & nilai wajib diisi");
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        deskripsi: form.deskripsi || null,
        tipe: form.tipe,
        nilai: Number(form.nilai),
        min_belanja: Number(form.min_belanja || 0),
        max_diskon: form.max_diskon ? Number(form.max_diskon) : null,
        kuota: form.kuota ? Number(form.kuota) : null,
        berlaku_sampai: form.berlaku_sampai || null,
        is_active: form.is_active,
        created_by: user?.id,
      };
      const { error } = await supabase.from("marketplace_coupons").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kupon dibuat");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kupon dihapus");
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase
        .from("marketplace_coupons")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kupon Diskon Marketplace</h1>
          <p className="text-sm text-muted-foreground">Buat dan kelola kupon untuk transaksi marketplace.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />Kupon Baru</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Kupon Baru</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Kode Kupon</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HEMAT10" />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipe</Label>
                  <Select value={form.tipe} onValueChange={(v: any) => setForm({ ...form, tipe: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Persen (%)</SelectItem>
                      <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nilai {form.tipe === "percent" ? "(%)" : "(Rp)"}</Label>
                  <Input type="number" value={form.nilai} onChange={(e) => setForm({ ...form, nilai: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Min. Belanja (Rp)</Label>
                  <Input type="number" value={form.min_belanja} onChange={(e) => setForm({ ...form, min_belanja: e.target.value })} />
                </div>
                {form.tipe === "percent" && (
                  <div>
                    <Label>Max Diskon (Rp)</Label>
                    <Input type="number" value={form.max_diskon} onChange={(e) => setForm({ ...form, max_diskon: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Kuota</Label>
                  <Input type="number" value={form.kuota} onChange={(e) => setForm({ ...form, kuota: e.target.value })} placeholder="Kosong = unlimited" />
                </div>
                <div>
                  <Label>Berlaku sampai</Label>
                  <Input type="date" value={form.berlaku_sampai} onChange={(e) => setForm({ ...form, berlaku_sampai: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Aktif</Label>
              </div>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kupon"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4 text-primary" /> Daftar Kupon</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Memuat…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Diskon</TableHead>
                  <TableHead>Min. Belanja</TableHead>
                  <TableHead>Pemakaian</TableHead>
                  <TableHead>Berakhir</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons?.length ? coupons.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button
                        onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Kode disalin"); }}
                        className="font-mono font-semibold inline-flex items-center gap-1 hover:text-primary"
                      >
                        {c.code} <Copy className="h-3 w-3" />
                      </button>
                      {c.deskripsi && <p className="text-xs text-muted-foreground mt-0.5">{c.deskripsi}</p>}
                    </TableCell>
                    <TableCell>
                      {c.tipe === "percent" ? `${c.nilai}%` : fmt(Number(c.nilai))}
                      {c.max_diskon && <span className="text-xs text-muted-foreground"> (max {fmt(Number(c.max_diskon))})</span>}
                    </TableCell>
                    <TableCell>{fmt(Number(c.min_belanja))}</TableCell>
                    <TableCell>{c.used_count}{c.kuota ? ` / ${c.kuota}` : ""}</TableCell>
                    <TableCell className="text-xs">{c.berlaku_sampai ?? "—"}</TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive.mutate(c)} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus kupon?")) del.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada kupon</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cara Pakai</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Buat kupon dengan kode unik (mis. <code className="font-mono">HEMAT10</code>).</p>
          <p>2. Bagikan kode ke anggota lewat pengumuman / WA.</p>
          <p>3. Pembeli memasukkan kode di halaman checkout untuk mendapat potongan harga.</p>
          <p className="pt-2 border-t">Penjual juga dapat membuat kupon untuk toko mereka sendiri lewat menu <strong>Marketplace Saya</strong>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
