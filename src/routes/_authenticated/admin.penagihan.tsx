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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Phone, MapPin, RefreshCw, AlertTriangle, FileText, Plus, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/penagihan")({
  head: () => ({ meta: [{ title: "Penagihan — T-COOL Admin" }] }),
  component: PenagihanPage,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

type Case = {
  id: string;
  pinjaman_id: string;
  user_id: string;
  status: "open" | "in_progress" | "promised" | "restructured" | "written_off" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  hari_terlambat: number;
  total_tunggakan: number;
  total_denda: number;
  jumlah_cicilan_tertunggak: number;
  pic_kolektor: string | null;
  catatan: string | null;
  opened_at: string;
  closed_at: string | null;
  profiles?: { nama_lengkap: string | null; no_hp: string | null; alamat: string | null; nomor_anggota: string | null } | null;
  pinjaman?: { nominal: number; tenor_bulan: number; status: string } | null;
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  promised: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  restructured: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  written_off: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function PenagihanPage() {
  const { roles } = useAuth();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "sekretaris", "bendahara"].includes(r));
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [activeCase, setActiveCase] = useState<Case | null>(null);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["collection-cases", tab],
    enabled: isPengurus,
    queryFn: async () => {
      let q = supabase
        .from("collection_cases" as any)
        .select("*, profiles:user_id(nama_lengkap, no_hp, alamat, nomor_anggota), pinjaman:pinjaman_id(nominal, tenor_bulan, status)")
        .order("priority", { ascending: false })
        .order("hari_terlambat", { ascending: false });
      if (tab === "active") q = q.not("status", "in", "(closed,written_off,restructured)");
      else if (tab === "critical") q = q.eq("priority", "critical").not("status", "in", "(closed,written_off)");
      else if (tab === "closed") q = q.in("status", ["closed", "restructured", "written_off"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Case[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("sync_collection_cases" as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast.success(`Sinkronisasi selesai. ${n} kasus baru dibuat.`);
      qc.invalidateQueries({ queryKey: ["collection-cases"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal sinkron"),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return cases.filter((c) =>
      !s ||
      c.profiles?.nama_lengkap?.toLowerCase().includes(s) ||
      c.profiles?.nomor_anggota?.toLowerCase().includes(s),
    );
  }, [cases, search]);

  const stats = useMemo(() => {
    const active = cases.filter((c) => !["closed", "written_off", "restructured"].includes(c.status));
    return {
      totalCases: active.length,
      totalTunggakan: active.reduce((s, c) => s + Number(c.total_tunggakan), 0),
      totalDenda: active.reduce((s, c) => s + Number(c.total_denda), 0),
      critical: active.filter((c) => c.priority === "critical").length,
    };
  }, [cases]);

  if (!isPengurus) {
    return <EmptyState icon={ShieldAlert} title="Akses Ditolak" desc="Halaman penagihan hanya untuk pengurus." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modul Penagihan</h1>
          <p className="text-sm text-muted-foreground">Daftar tunggakan, log kontak, dan restrukturisasi pinjaman.</p>
        </div>
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} variant="outline" className="gap-2">
          {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sinkron Tunggakan
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Kasus Aktif" value={String(stats.totalCases)} />
        <StatCard label="Total Tunggakan" value={fmt(stats.totalTunggakan)} />
        <StatCard label="Total Denda" value={fmt(stats.totalDenda)} />
        <StatCard label="Prioritas Critical" value={String(stats.critical)} highlight />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="active">Aktif</TabsTrigger>
              <TabsTrigger value="critical">Critical</TabsTrigger>
              <TabsTrigger value="closed">Selesai</TabsTrigger>
              <TabsTrigger value="all">Semua</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Cari nama / no. anggota…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:w-64" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Tidak ada kasus" desc="Klik 'Sinkron Tunggakan' untuk memunculkan kasus terbaru dari angsuran yang lewat jatuh tempo." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anggota</TableHead>
                    <TableHead>Hari Telat</TableHead>
                    <TableHead>Cicilan Tertunggak</TableHead>
                    <TableHead>Total Tunggakan</TableHead>
                    <TableHead>Denda</TableHead>
                    <TableHead>Prioritas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.profiles?.nama_lengkap ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.profiles?.nomor_anggota ?? "—"} · {c.profiles?.no_hp ?? "—"}</div>
                      </TableCell>
                      <TableCell><span className="font-semibold">{c.hari_terlambat}</span> hari</TableCell>
                      <TableCell>{c.jumlah_cicilan_tertunggak}x</TableCell>
                      <TableCell className="font-mono text-sm">{fmt(Number(c.total_tunggakan))}</TableCell>
                      <TableCell className="font-mono text-sm">{fmt(Number(c.total_denda))}</TableCell>
                      <TableCell><Badge className={PRIORITY_BADGE[c.priority]}>{c.priority}</Badge></TableCell>
                      <TableCell><Badge className={STATUS_BADGE[c.status]}>{c.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setActiveCase(c)}>Detail</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CaseSheet caseData={activeCase} onClose={() => setActiveCase(null)} />
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-rose-300 dark:border-rose-800" : ""}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-bold ${highlight ? "text-rose-600 dark:text-rose-400" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

type LogRow = {
  id: string;
  action: string;
  outcome: string;
  kontak_tanggal: string;
  isi_pembicaraan: string | null;
  janji_bayar_tanggal: string | null;
  janji_bayar_nominal: number | null;
  lokasi: string | null;
};

type Restructure = {
  id: string;
  alasan: string;
  new_pokok: number;
  new_tenor_bulan: number;
  new_bunga_persen: number;
  new_cicilan_per_bulan: number;
  new_jatuh_tempo_mulai: string;
  status: string;
  created_at: string;
};

function CaseSheet({ caseData, onClose }: { caseData: Case | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showLog, setShowLog] = useState(false);
  const [showRestr, setShowRestr] = useState(false);

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["collection-logs", caseData?.id],
    enabled: !!caseData,
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_logs" as any).select("*").eq("case_id", caseData!.id).order("kontak_tanggal", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
  });

  const { data: restrs = [] } = useQuery({
    queryKey: ["restr", caseData?.id],
    enabled: !!caseData,
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_restructures" as any).select("*").eq("case_id", caseData!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Restructure[];
    },
  });

  // Form log
  const [log, setLog] = useState({ action: "call", outcome: "contacted", isi: "", janji_tgl: "", janji_nom: "", lokasi: "" });
  const saveLog = useMutation({
    mutationFn: async () => {
      const payload: any = {
        case_id: caseData!.id,
        action: log.action,
        outcome: log.outcome,
        isi_pembicaraan: log.isi || null,
        lokasi: log.lokasi || null,
        kontak_oleh: user?.id,
        created_by: user?.id,
      };
      if (log.janji_tgl) payload.janji_bayar_tanggal = log.janji_tgl;
      if (log.janji_nom) payload.janji_bayar_nominal = Number(log.janji_nom);
      const { error } = await supabase.from("collection_logs" as any).insert(payload);
      if (error) throw error;
      // Update status case
      const newStatus = log.outcome === "promise_to_pay" ? "promised" : "in_progress";
      await supabase.from("collection_cases" as any).update({ status: newStatus, updated_by: user?.id }).eq("id", caseData!.id);
    },
    onSuccess: () => {
      toast.success("Log kontak tersimpan");
      setShowLog(false);
      setLog({ action: "call", outcome: "contacted", isi: "", janji_tgl: "", janji_nom: "", lokasi: "" });
      qc.invalidateQueries({ queryKey: ["collection-logs"] });
      qc.invalidateQueries({ queryKey: ["collection-cases"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal simpan log"),
  });

  // Form restrukturisasi
  const [restr, setRestr] = useState({ alasan: "", new_pokok: "", new_tenor: "12", new_bunga: "1.5", new_mulai: new Date().toISOString().slice(0, 10), diskon_denda: "0" });
  const saveRestr = useMutation({
    mutationFn: async () => {
      const pokok = Number(restr.new_pokok);
      const tenor = Number(restr.new_tenor);
      const bunga = Number(restr.new_bunga);
      if (!pokok || !tenor) throw new Error("Pokok & tenor wajib diisi");
      const totalBunga = pokok * (bunga / 100) * tenor;
      const cicilan = Math.ceil((pokok + totalBunga) / tenor);
      const { error } = await supabase.from("loan_restructures" as any).insert({
        pinjaman_id: caseData!.pinjaman_id,
        case_id: caseData!.id,
        user_id: caseData!.user_id,
        alasan: restr.alasan,
        old_sisa_pokok: caseData!.total_tunggakan,
        old_bunga_persen: 0,
        old_tenor_sisa: 0,
        old_cicilan: 0,
        new_pokok: pokok,
        new_tenor_bulan: tenor,
        new_bunga_persen: bunga,
        new_cicilan_per_bulan: cicilan,
        new_jatuh_tempo_mulai: restr.new_mulai,
        diskon_denda: Number(restr.diskon_denda) || 0,
        status: "pending",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Restrukturisasi diajukan");
      setShowRestr(false);
      qc.invalidateQueries({ queryKey: ["restr"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal ajukan restrukturisasi"),
  });

  const approveRestr = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_restructures" as any).update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        effective_at: new Date().toISOString().slice(0, 10),
      }).eq("id", id);
      if (error) throw error;
      // Tutup case sebagai restructured
      await supabase.from("collection_cases" as any).update({ status: "restructured", closed_at: new Date().toISOString(), closed_reason: "Restrukturisasi disetujui" }).eq("id", caseData!.id);
    },
    onSuccess: () => {
      toast.success("Restrukturisasi disetujui");
      qc.invalidateQueries({ queryKey: ["restr"] });
      qc.invalidateQueries({ queryKey: ["collection-cases"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal approve"),
  });

  const writeOff = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("collection_cases" as any).update({
        status: "written_off",
        closed_at: new Date().toISOString(),
        closed_reason: "Hapus buku (write-off)",
        updated_by: user?.id,
      }).eq("id", caseData!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kasus di-write-off");
      qc.invalidateQueries({ queryKey: ["collection-cases"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Gagal"),
  });

  if (!caseData) return null;

  return (
    <Sheet open={!!caseData} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Detail Kasus Penagihan</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Anggota</span><span className="font-semibold">{caseData.profiles?.nama_lengkap ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">No. Anggota</span><span>{caseData.profiles?.nomor_anggota ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">No. HP</span><span>{caseData.profiles?.no_hp ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Alamat</span><span className="text-right">{caseData.profiles?.alamat ?? "—"}</span></div>
              <hr className="my-2" />
              <div className="flex justify-between"><span className="text-muted-foreground">Hari Terlambat</span><span className="font-bold text-rose-600">{caseData.hari_terlambat} hari</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cicilan Tertunggak</span><span>{caseData.jumlah_cicilan_tertunggak}x</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Tunggakan</span><span className="font-mono">{fmt(Number(caseData.total_tunggakan))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Denda</span><span className="font-mono">{fmt(Number(caseData.total_denda))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Prioritas</span><Badge className={PRIORITY_BADGE[caseData.priority]}>{caseData.priority}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={STATUS_BADGE[caseData.status]}>{caseData.status}</Badge></div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Dialog open={showLog} onOpenChange={setShowLog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Log Kontak</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Tambah Log Kontak</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Aksi</Label>
                      <Select value={log.action} onValueChange={(v) => setLog({ ...log, action: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Telepon</SelectItem>
                          <SelectItem value="visit">Kunjungan</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="letter">Surat</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="other">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Hasil</Label>
                      <Select value={log.outcome} onValueChange={(v) => setLog({ ...log, outcome: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_contact">Tidak Terhubung</SelectItem>
                          <SelectItem value="contacted">Terhubung</SelectItem>
                          <SelectItem value="promise_to_pay">Janji Bayar</SelectItem>
                          <SelectItem value="partial_payment">Bayar Sebagian</SelectItem>
                          <SelectItem value="full_payment">Bayar Lunas</SelectItem>
                          <SelectItem value="refused">Menolak</SelectItem>
                          <SelectItem value="escalate">Eskalasi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Catatan / Isi Pembicaraan</Label>
                    <Textarea value={log.isi} onChange={(e) => setLog({ ...log, isi: e.target.value })} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Janji Bayar (tanggal)</Label>
                      <Input type="date" value={log.janji_tgl} onChange={(e) => setLog({ ...log, janji_tgl: e.target.value })} />
                    </div>
                    <div>
                      <Label>Nominal Janji</Label>
                      <Input type="number" value={log.janji_nom} onChange={(e) => setLog({ ...log, janji_nom: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Lokasi (jika kunjungan)</Label>
                    <Input value={log.lokasi} onChange={(e) => setLog({ ...log, lokasi: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowLog(false)}>Batal</Button>
                  <Button onClick={() => saveLog.mutate()} disabled={saveLog.isPending}>
                    {saveLog.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showRestr} onOpenChange={setShowRestr}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2"><FileText className="h-4 w-4" /> Ajukan Restrukturisasi</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Restrukturisasi Pinjaman</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Alasan</Label>
                    <Textarea value={restr.alasan} onChange={(e) => setRestr({ ...restr, alasan: e.target.value })} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Pokok Baru</Label>
                      <Input type="number" value={restr.new_pokok} onChange={(e) => setRestr({ ...restr, new_pokok: e.target.value })} />
                    </div>
                    <div>
                      <Label>Tenor (bulan)</Label>
                      <Input type="number" value={restr.new_tenor} onChange={(e) => setRestr({ ...restr, new_tenor: e.target.value })} />
                    </div>
                    <div>
                      <Label>Bunga (% per bulan)</Label>
                      <Input type="number" step="0.1" value={restr.new_bunga} onChange={(e) => setRestr({ ...restr, new_bunga: e.target.value })} />
                    </div>
                    <div>
                      <Label>Mulai Jatuh Tempo</Label>
                      <Input type="date" value={restr.new_mulai} onChange={(e) => setRestr({ ...restr, new_mulai: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>Diskon Denda</Label>
                      <Input type="number" value={restr.diskon_denda} onChange={(e) => setRestr({ ...restr, diskon_denda: e.target.value })} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRestr(false)}>Batal</Button>
                  <Button onClick={() => saveRestr.mutate()} disabled={saveRestr.isPending}>
                    {saveRestr.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ajukan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {!["closed", "written_off", "restructured"].includes(caseData.status) && (
              <Button size="sm" variant="destructive" onClick={() => { if (confirm("Tandai kasus sebagai hapus buku?")) writeOff.mutate(); }}>
                Write-off
              </Button>
            )}
          </div>

          {/* Logs */}
          <div>
            <h3 className="mb-2 font-semibold">Riwayat Kontak ({logs.length})</h3>
            {logsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada log kontak.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {l.action === "call" ? <Phone className="h-4 w-4" /> : l.action === "visit" ? <MapPin className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        <span className="font-medium capitalize">{l.action.replace("_", " ")}</span>
                        <Badge variant="outline" className="text-[10px]">{l.outcome.replace("_", " ")}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(l.kontak_tanggal).toLocaleString("id-ID")}</span>
                    </div>
                    {l.isi_pembicaraan && <p className="mt-1 text-muted-foreground">{l.isi_pembicaraan}</p>}
                    {l.janji_bayar_tanggal && (
                      <p className="mt-1 text-xs"><b>Janji bayar:</b> {l.janji_bayar_tanggal} {l.janji_bayar_nominal ? `(${fmt(Number(l.janji_bayar_nominal))})` : ""}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Restructures */}
          <div>
            <h3 className="mb-2 font-semibold">Restrukturisasi ({restrs.length})</h3>
            {restrs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada restrukturisasi.</p>
            ) : (
              <div className="space-y-2">
                {restrs.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <Badge className={STATUS_BADGE[r.status as keyof typeof STATUS_BADGE] ?? ""}>{r.status}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.alasan}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>Pokok: <b>{fmt(Number(r.new_pokok))}</b></div>
                      <div>Tenor: <b>{r.new_tenor_bulan} bulan</b></div>
                      <div>Bunga: <b>{r.new_bunga_persen}%/bln</b></div>
                      <div>Cicilan: <b>{fmt(Number(r.new_cicilan_per_bulan))}</b></div>
                    </div>
                    {r.status === "pending" && (
                      <Button size="sm" className="mt-2" onClick={() => approveRestr.mutate(r.id)} disabled={approveRestr.isPending}>
                        Approve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
