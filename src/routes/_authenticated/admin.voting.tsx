import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Vote, BarChart3, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/voting")({
  head: () => ({ meta: [{ title: "E-Voting RAT — Admin" }] }),
  component: AdminVotingPage,
});

function AdminVotingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [opsiInput, setOpsiInput] = useState("");
  const [opsiList, setOpsiList] = useState<string[]>([]);
  const [selesai, setSelesai] = useState("");
  const [multi, setMulti] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);

  const { data: votings, isLoading } = useQuery({
    queryKey: ["admin-votings"],
    queryFn: async () => {
      const { data } = await supabase.from("rat_votings" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!judul.trim() || opsiList.length < 2 || !selesai) throw new Error("Lengkapi judul, ≥2 opsi, dan tanggal selesai");
      const { error } = await supabase.from("rat_votings" as any).insert({
        judul, deskripsi, opsi: opsiList, selesai: new Date(selesai).toISOString(),
        multi_select: multi, status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voting dibuat (draft)");
      setOpen(false); setJudul(""); setDeskripsi(""); setOpsiList([]); setOpsiInput(""); setSelesai(""); setMulti(false);
      qc.invalidateQueries({ queryKey: ["admin-votings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("rat_votings" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status diperbarui"); qc.invalidateQueries({ queryKey: ["admin-votings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Vote className="h-6 w-6 text-primary" /> E-Voting RAT</h1>
          <p className="text-sm text-muted-foreground">Kelola voting digital untuk keputusan rapat anggota.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Voting Baru</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Buat Voting RAT</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Judul</Label><Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Persetujuan Laporan Keuangan 2025" /></div>
              <div><Label>Deskripsi</Label><Textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={3} /></div>
              <div>
                <Label>Opsi pilihan (minimal 2)</Label>
                <div className="flex gap-2">
                  <Input value={opsiInput} onChange={(e) => setOpsiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && opsiInput.trim()) { e.preventDefault(); setOpsiList([...opsiList, opsiInput.trim()]); setOpsiInput(""); } }}
                    placeholder="Setuju / Tolak / Abstain" />
                  <Button type="button" variant="secondary" onClick={() => { if (opsiInput.trim()) { setOpsiList([...opsiList, opsiInput.trim()]); setOpsiInput(""); } }}>Tambah</Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {opsiList.map((o, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">{o}
                      <button onClick={() => setOpsiList(opsiList.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div><Label>Berakhir pada</Label><Input type="datetime-local" value={selesai} onChange={(e) => setSelesai(e.target.value)} /></div>
              <div className="flex items-center gap-2"><Switch checked={multi} onCheckedChange={setMulti} /><Label>Boleh pilih lebih dari satu</Label></div>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="w-full">
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {(votings ?? []).map((v: any) => (
            <Card key={v.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{v.judul}</CardTitle>
                  <Badge variant={v.status === "active" ? "default" : v.status === "closed" ? "secondary" : "outline"}>{v.status}</Badge>
                </div>
                {v.deskripsi && <p className="text-xs text-muted-foreground">{v.deskripsi}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">Berakhir: {new Date(v.selesai).toLocaleString("id-ID")}</div>
                <div className="flex flex-wrap gap-1.5">{(v.opsi as string[]).map((o, i) => <Badge key={i} variant="outline">{o}</Badge>)}</div>
                <div className="flex flex-wrap gap-2">
                  <Select value={v.status} onValueChange={(val) => updateStatus.mutate({ id: v.id, status: val })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="closed">Tutup</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setResultId(v.id)}><BarChart3 className="h-4 w-4" /> Hasil</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resultId} onOpenChange={(o) => !o && setResultId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hasil Voting</DialogTitle></DialogHeader>
          {resultId && <VotingResult id={resultId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VotingResult({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["voting-result", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rat_voting_result" as any, { _voting_id: id });
      if (error) throw error;
      return data as any;
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  const total = data?.total_pemilih ?? 0;
  const hasil = (data?.hasil ?? []) as { opsi: string; jumlah: number }[];
  return (
    <div className="space-y-3">
      <div className="text-sm">Total pemilih: <b>{total}</b></div>
      {hasil.map((h) => {
        const pct = total > 0 ? Math.round((h.jumlah / total) * 100) : 0;
        return (
          <div key={h.opsi}>
            <div className="flex justify-between text-sm"><span>{h.opsi}</span><span className="font-semibold">{h.jumlah} ({pct}%)</span></div>
            <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}
