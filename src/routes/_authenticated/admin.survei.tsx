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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ClipboardList, Eye, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/survei")({
  head: () => ({ meta: [{ title: "Kelola Survei — Admin" }] }),
  component: AdminSurveiPage,
});

function AdminSurveiPage() {
  const qc = useQueryClient();
  const [openSurvey, setOpenSurvey] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState({ judul: "", deskripsi: "", target: "semua", anonim: false });

  const { data: surveys } = useQuery({
    queryKey: ["admin-surveys"],
    queryFn: async () => {
      const { data } = await supabase.from("surveys" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.judul) throw new Error("Judul wajib");
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("surveys" as any).insert({ ...form, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Survei dibuat");
      setOpenSurvey(false);
      setForm({ judul: "", deskripsi: "", target: "semua", anonim: false });
      qc.invalidateQueries({ queryKey: ["admin-surveys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("surveys" as any).update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status diperbarui");
      qc.invalidateQueries({ queryKey: ["admin-surveys"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Survei</h1>
          <p className="text-sm text-muted-foreground">Buat survei kepuasan dan lihat hasilnya.</p>
        </div>
        <Dialog open={openSurvey} onOpenChange={setOpenSurvey}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Survei Baru</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Buat Survei</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Judul</Label><Input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} /></div>
              <div><Label>Deskripsi</Label><Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /></div>
              <div>
                <Label>Target</Label>
                <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua anggota</SelectItem>
                    <SelectItem value="peminjam">Peminjam aktif</SelectItem>
                    <SelectItem value="penabung">Penabung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Tanggapan anonim</Label>
                <Switch checked={form.anonim} onCheckedChange={(v) => setForm({ ...form, anonim: v })} />
              </div>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle>Daftar Survei</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Judul</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Anonim</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {surveys?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.judul}</TableCell>
                  <TableCell><Badge variant="outline">{s.target}</Badge></TableCell>
                  <TableCell>
                    <Select value={s.status} onValueChange={(v) => setStatus.mutate({ id: s.id, status: v })}>
                      <SelectTrigger className="w-[110px] h-7"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="closed">Ditutup</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{s.anonim ? "Ya" : "Tidak"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setViewId(s.id)}>
                      <Eye className="h-3.5 w-3.5" />Kelola
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!surveys?.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />Belum ada survei
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {viewId && <SurveyManageDialog surveyId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function SurveyManageDialog({ surveyId, onClose }: { surveyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [qForm, setQForm] = useState({ pertanyaan: "", tipe: "teks", wajib: true, opsi: "" });

  const { data: questions } = useQuery({
    queryKey: ["sq-admin", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_questions" as any).select("*").eq("survey_id", surveyId).order("urutan");
      return (data as any[]) ?? [];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["sr-admin", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("survey_responses" as any).select("*").eq("survey_id", surveyId).order("submitted_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const addQ = useMutation({
    mutationFn: async () => {
      if (!qForm.pertanyaan) throw new Error("Pertanyaan wajib diisi");
      const opsi = qForm.tipe === "pilihan" ? qForm.opsi.split("\n").filter(Boolean) : null;
      const { error } = await supabase.from("survey_questions" as any).insert({
        survey_id: surveyId,
        pertanyaan: qForm.pertanyaan,
        tipe: qForm.tipe,
        wajib: qForm.wajib,
        opsi,
        urutan: (questions?.length ?? 0) + 1,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pertanyaan ditambahkan");
      setQForm({ pertanyaan: "", tipe: "teks", wajib: true, opsi: "" });
      qc.invalidateQueries({ queryKey: ["sq-admin", surveyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delQ = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("survey_questions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sq-admin", surveyId] }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Kelola Pertanyaan & Hasil</DialogTitle></DialogHeader>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4" />Pertanyaan ({questions?.length ?? 0})</h3>
          {questions?.map((q, i) => (
            <div key={q.id} className="flex items-start gap-2 p-2 border rounded">
              <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
              <div className="flex-1">
                <p className="text-sm">{q.pertanyaan}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">{q.tipe}</Badge>
                  {q.wajib && <Badge variant="secondary" className="text-xs">wajib</Badge>}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => delQ.mutate(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}

          <div className="border rounded p-3 space-y-2 bg-muted/30">
            <Input placeholder="Tulis pertanyaan…" value={qForm.pertanyaan} onChange={(e) => setQForm({ ...qForm, pertanyaan: e.target.value })} />
            <div className="flex gap-2">
              <Select value={qForm.tipe} onValueChange={(v) => setQForm({ ...qForm, tipe: v })}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teks">Teks</SelectItem>
                  <SelectItem value="angka">Angka</SelectItem>
                  <SelectItem value="rating">Rating 1-5</SelectItem>
                  <SelectItem value="pilihan">Pilihan</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={qForm.wajib} onCheckedChange={(v) => setQForm({ ...qForm, wajib: v })} /> Wajib
              </label>
              <Button size="sm" onClick={() => addQ.mutate()} disabled={addQ.isPending} className="ml-auto">
                <Plus className="h-3.5 w-3.5" />Tambah
              </Button>
            </div>
            {qForm.tipe === "pilihan" && (
              <Textarea placeholder="Satu opsi per baris" value={qForm.opsi} onChange={(e) => setQForm({ ...qForm, opsi: e.target.value })} rows={3} />
            )}
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />Hasil ({responses?.length ?? 0} tanggapan)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {responses?.map((r) => (
              <div key={r.id} className="border rounded p-2 text-xs">
                <div className="text-muted-foreground mb-1">{new Date(r.submitted_at).toLocaleString("id-ID")}</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(r.jawaban, null, 2)}</pre>
              </div>
            ))}
            {!responses?.length && <p className="text-sm text-muted-foreground text-center py-4">Belum ada tanggapan</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
