import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Coins, Calculator, Send, AlertTriangle, FileSpreadsheet, FileText, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { buildSignedReportPdf } from "@/lib/report-pdf";

export const Route = createFileRoute("/_authenticated/admin/shu")({
  head: () => ({ meta: [{ title: "Distribusi SHU — Admin" }] }),
  component: AdminShu,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const currentYear = new Date().getFullYear();

function AdminShu() {
  const { user, roles, profile } = useAuth();
  const isBendahara = roles.some((r) => ["super_admin", "bendahara"].includes(r));
  const isKetua = roles.some((r) => ["super_admin", "ketua"].includes(r));
  const isPengurus = isBendahara || isKetua;
  const qc = useQueryClient();

  const [tahun, setTahun] = useState<number>(currentYear - 1);
  const [pool, setPool] = useState<number>(0);
  const [jasaModal, setJasaModal] = useState<number>(40);
  const [jasaUsaha, setJasaUsaha] = useState<number>(40);
  const [cadangan, setCadangan] = useState<number>(20);
  const [catatan, setCatatan] = useState<string>("");

  // Load bobot & alokasi default dari settings koperasi
  const { data: settings } = useQuery({
    queryKey: ["shu-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("key,value").like("key", "shu.%");
      const m: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        const raw = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
        const n = Number(String(raw).replace(/^"|"$/g, ""));
        if (!isNaN(n)) m[r.key] = n;
      });
      return m;
    },
  });

  const W = {
    pokok: settings?.["shu.bobot_simpanan_pokok"] ?? 1.0,
    wajib: settings?.["shu.bobot_simpanan_wajib"] ?? 1.5,
    sukarela: settings?.["shu.bobot_simpanan_sukarela"] ?? 0.5,
    bunga: settings?.["shu.bobot_jasa_pinjaman"] ?? 1.0,
    belanja: settings?.["shu.bobot_jasa_belanja"] ?? 0.5,
    deposito: settings?.["shu.bobot_jasa_deposito"] ?? 0.3,
    minKeaktifan: settings?.["shu.min_keaktifan_persen"] ?? 0,
    penaltiTunggakan: settings?.["shu.penalti_tunggakan_persen"] ?? 0,
  };

  // Pre-fill alokasi pot dari settings (sekali)
  useEffect(() => {
    if (!settings) return;
    const m = settings["shu.persen_jasa_modal"];
    const u = settings["shu.persen_jasa_usaha"];
    const c = settings["shu.persen_dana_cadangan"];
    if (m != null) setJasaModal(m);
    if (u != null) setJasaUsaha(u);
    if (c != null) setCadangan(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const { data: existing = [] } = useQuery({
    queryKey: ["shu-year", tahun],
    queryFn: async () => {
      const { data, error } = await supabase.from("shu").select("id,user_id,nominal,catatan,dibagikan_at,created_at, profiles:user_id(nama_lengkap,nomor_anggota)").eq("tahun", tahun);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["shu-base", tahun],
    queryFn: async () => {
      const start = `${tahun}-01-01`;
      const end = `${tahun}-12-31T23:59:59`;
      const [profsRes, simpRes, pjRes, mpRes, tbRes, angTunggakRes] = await Promise.all([
        supabase.from("profiles").select("id,nomor_anggota,nama_lengkap").eq("status", "active"),
        // Simpanan per jenis (kumulatif sampai akhir tahun)
        supabase.from("simpanan").select("user_id,jenis,nominal").eq("status", "verified").lte("created_at", end),
        // Bunga dari pinjaman yang berjalan di tahun ybs
        supabase.from("pinjaman").select("user_id,total_bayar,nominal,disbursed_at").in("status", ["disbursed", "completed", "approved"]).gte("disbursed_at", start).lte("disbursed_at", end),
        // Belanja marketplace (sebagai buyer) yang completed/paid/shipped di tahun ybs
        supabase.from("marketplace_transactions").select("buyer_id,total,created_at,status").in("status", ["paid", "shipped", "completed"]).gte("created_at", start).lte("created_at", end),
        // Tabungan berjangka aktif di tahun ybs
        supabase.from("tabungan_berjangka").select("user_id,nominal_pokok,created_at").lte("created_at", end),
        // Tunggakan angsuran (overdue belum lunas)
        supabase.from("angsuran").select("user_id,status,jatuh_tempo").neq("status", "paid").lte("jatuh_tempo", end),
      ]);

      const pokokMap = new Map<string, number>();
      const wajibMap = new Map<string, number>();
      const sukarelaMap = new Map<string, number>();
      (simpRes.data ?? []).forEach((s) => {
        const v = Number(s.nominal);
        if (s.jenis === "pokok") pokokMap.set(s.user_id, (pokokMap.get(s.user_id) ?? 0) + v);
        else if (s.jenis === "wajib") wajibMap.set(s.user_id, (wajibMap.get(s.user_id) ?? 0) + v);
        else sukarelaMap.set(s.user_id, (sukarelaMap.get(s.user_id) ?? 0) + v);
      });

      const bungaMap = new Map<string, number>();
      (pjRes.data ?? []).forEach((p) => bungaMap.set(p.user_id, (bungaMap.get(p.user_id) ?? 0) + Math.max(0, Number(p.total_bayar ?? 0) - Number(p.nominal ?? 0))));

      const belanjaMap = new Map<string, number>();
      (mpRes.data ?? []).forEach((t) => belanjaMap.set(t.buyer_id, (belanjaMap.get(t.buyer_id) ?? 0) + Number(t.total)));

      const depoMap = new Map<string, number>();
      (tbRes.data ?? []).forEach((t) => depoMap.set(t.user_id, (depoMap.get(t.user_id) ?? 0) + Number(t.nominal_pokok ?? 0)));

      const tunggakMap = new Map<string, number>();
      (angTunggakRes.data ?? []).forEach((a) => tunggakMap.set(a.user_id, (tunggakMap.get(a.user_id) ?? 0) + 1));

      return (profsRes.data ?? []).map((p) => ({
        id: p.id,
        nomor: p.nomor_anggota ?? "—",
        nama: p.nama_lengkap,
        pokok: pokokMap.get(p.id) ?? 0,
        wajib: wajibMap.get(p.id) ?? 0,
        sukarela: sukarelaMap.get(p.id) ?? 0,
        bunga: bungaMap.get(p.id) ?? 0,
        belanja: belanjaMap.get(p.id) ?? 0,
        deposito: depoMap.get(p.id) ?? 0,
        tunggak: tunggakMap.get(p.id) ?? 0,
      }));
    },
  });

  const enriched = useMemo(() => {
    return (members ?? []).map((m) => ({
      ...m,
      simpanan: m.pokok + m.wajib + m.sukarela,
      skorModal: m.pokok * W.pokok + m.wajib * W.wajib + m.sukarela * W.sukarela,
      skorUsaha: m.bunga * W.bunga + m.belanja * W.belanja + m.deposito * W.deposito,
    }));
  }, [members, W.pokok, W.wajib, W.sukarela, W.bunga, W.belanja, W.deposito]);

  const totals = useMemo(() => {
    const sumSimp = enriched.reduce((a, b) => a + b.simpanan, 0);
    const sumBunga = enriched.reduce((a, b) => a + b.bunga, 0);
    const sumSkorModal = enriched.reduce((a, b) => a + b.skorModal, 0);
    const sumSkorUsaha = enriched.reduce((a, b) => a + b.skorUsaha, 0);
    return { sumSimp, sumBunga, sumSkorModal, sumSkorUsaha };
  }, [enriched]);

  const totalPersen = jasaModal + jasaUsaha + cadangan;
  const poolModal = pool * (jasaModal / 100);
  const poolUsaha = pool * (jasaUsaha / 100);

  const distribusi = useMemo(() => {
    if (!enriched.length || pool <= 0) return [] as { id: string; nomor: string; nama: string; share: number }[];
    return enriched.map((m) => {
      const m1 = totals.sumSkorModal > 0 ? (m.skorModal / totals.sumSkorModal) * poolModal : 0;
      const m2 = totals.sumSkorUsaha > 0 ? (m.skorUsaha / totals.sumSkorUsaha) * poolUsaha : 0;
      let share = m1 + m2;
      // Penalti tunggakan
      if (m.tunggak > 0 && W.penaltiTunggakan > 0) share = share * (1 - W.penaltiTunggakan / 100);
      return { id: m.id, nomor: m.nomor, nama: m.nama, share: Math.round(share) };
    });
  }, [enriched, totals, poolModal, poolUsaha, pool, W.penaltiTunggakan]);

  // Workflow status: draft = bendahara proposed (dibagikan_at IS NULL), approved = ketua approved (dibagikan_at set)
  const draft = existing.filter((r) => !r.dibagikan_at);
  const approved = existing.filter((r) => r.dibagikan_at);
  const stage: "none" | "draft" | "approved" = approved.length > 0 ? "approved" : draft.length > 0 ? "draft" : "none";

  const propose = useMutation({
    mutationFn: async () => {
      if (!isBendahara) throw new Error("Hanya Bendahara yang dapat mengusulkan SHU");
      if (pool <= 0) throw new Error("Pool SHU harus > 0");
      if (totalPersen !== 100) throw new Error("Total persentase harus 100%");
      if (stage !== "none") throw new Error(`SHU ${tahun} sudah ada (${stage})`);
      const rows = distribusi.filter((d) => d.share > 0).map((d) => ({
        user_id: d.id, tahun, nominal: d.share,
        catatan: catatan || `Usulan SHU ${tahun}`,
        dibagikan_at: null, created_by: user?.id,
      }));
      if (!rows.length) throw new Error("Tidak ada anggota dengan kontribusi");
      const { error } = await supabase.from("shu").insert(rows);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: user?.id, action: "shu.proposed", entity: "shu", new_data: { tahun, pool, anggota: rows.length } });
    },
    onSuccess: () => { toast.success(`Usulan SHU ${tahun} dikirim ke Ketua untuk approval`); qc.invalidateQueries({ queryKey: ["shu-year", tahun] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (sig: SignatureResult) => {
      if (!isKetua) throw new Error("Hanya Ketua yang dapat menyetujui SHU");
      if (stage !== "draft") throw new Error("Tidak ada usulan untuk disetujui");
      const ts = new Date().toISOString();
      const { error } = await supabase.from("shu").update({ dibagikan_at: ts, updated_by: user?.id }).eq("tahun", tahun).is("dibagikan_at", null);
      if (error) throw error;
      const { data: sigRow } = await supabase.from("signatures").insert({ user_id: user!.id, signature_url: sig.dataUrl, hash: sig.hash, ref_table: "shu" }).select("id").single();
      await supabase.from("notifications").insert(draft.map((r) => ({
        user_id: r.user_id, judul: `SHU Tahun ${tahun} Diterima`,
        pesan: `Anda menerima SHU sebesar ${fmt(Number(r.nominal))} untuk tahun buku ${tahun}.`,
        kategori: "sukses" as const, url: "/shu", ref_table: "shu",
      })));
      await supabase.from("audit_logs").insert({ actor_id: user?.id, action: "shu.approved", entity: "shu", new_data: { tahun, signature_id: sigRow?.id, signer: sig.fullName } });
    },
    onSuccess: () => { toast.success(`SHU ${tahun} disetujui & dibagikan`); qc.invalidateQueries({ queryKey: ["shu-year", tahun] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!isKetua) throw new Error("Hanya Ketua yang dapat menolak");
      const { error } = await supabase.from("shu").delete().eq("tahun", tahun).is("dibagikan_at", null);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: user?.id, action: "shu.rejected", entity: "shu", new_data: { tahun } });
    },
    onSuccess: () => { toast.success("Usulan SHU dikembalikan"); qc.invalidateQueries({ queryKey: ["shu-year", tahun] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Histori semua tahun
  const { data: history = [] } = useQuery({
    queryKey: ["shu-history"],
    queryFn: async () => {
      const { data } = await supabase.from("shu").select("tahun,nominal,dibagikan_at").order("tahun", { ascending: false });
      const map = new Map<number, { tahun: number; total: number; jumlah: number; status: string }>();
      (data ?? []).forEach((r) => {
        const cur = map.get(r.tahun) ?? { tahun: r.tahun, total: 0, jumlah: 0, status: "draft" };
        cur.total += Number(r.nominal); cur.jumlah += 1;
        if (r.dibagikan_at) cur.status = "approved";
        map.set(r.tahun, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.tahun - a.tahun);
    },
  });

  const exportShuExcel = () => {
    const rows = (existing.length ? existing : distribusi.map((d) => ({ profiles: { nomor_anggota: d.nomor, nama_lengkap: d.nama }, nominal: d.share, dibagikan_at: null }))) as Array<{ profiles: { nama_lengkap: string | null; nomor_anggota: string | null } | null; nominal: number; dibagikan_at: string | null }>;
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      "No. Anggota": r.profiles?.nomor_anggota ?? "—",
      "Nama": r.profiles?.nama_lengkap ?? "—",
      "Nominal SHU": Number(r.nominal),
      "Status": r.dibagikan_at ? "Dibagikan" : "Draft",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `SHU ${tahun}`);
    XLSX.writeFile(wb, `SHU-${tahun}.xlsx`);
    toast.success("Laporan Excel SHU diunduh");
  };

  const exportShuPdf = async (sig?: SignatureResult) => {
    const rows = (existing.length ? existing : distribusi.map((d) => ({ profiles: { nomor_anggota: d.nomor, nama_lengkap: d.nama }, nominal: d.share, dibagikan_at: null }))) as Array<{ profiles: { nama_lengkap: string | null; nomor_anggota: string | null } | null; nominal: number; dibagikan_at: string | null }>;
      const verifyId = `SHU-${tahun}-${Date.now()}`;
      const doc = await buildSignedReportPdf({
        title: `Laporan Distribusi SHU Tahun ${tahun}`,
        period: `Tahun Buku ${tahun}`,
        sections: [
          { title: "Ringkasan", head: ["Item", "Nilai"], body: [
            ["Total Pool SHU", fmt(pool || rows.reduce((s, r) => s + Number(r.nominal), 0))],
            ["Jasa Modal", `${jasaModal}%`],
            ["Jasa Usaha", `${jasaUsaha}%`],
            ["Cadangan", `${cadangan}%`],
            ["Jumlah Penerima", String(rows.length)],
            ["Status", stage === "approved" ? "Sudah Disetujui Ketua" : stage === "draft" ? "Menunggu Approval Ketua" : "Draft"],
          ] },
          { title: "Daftar Penerima", head: ["No.Anggota", "Nama", "Nominal"], body: rows.map((r) => [r.profiles?.nomor_anggota ?? "—", r.profiles?.nama_lengkap ?? "—", fmt(Number(r.nominal))]) },
        ],
        signatures: [
          { role: "Bendahara", name: profile?.nama_lengkap ?? "—" },
          { role: "Ketua", name: sig?.fullName ?? "—", dataUrl: sig?.dataUrl },
        ],
        verifyId,
      });
      await supabase.from("audit_logs").insert({ actor_id: user?.id, action: "shu.report_exported", entity: "shu_report", entity_id: null, new_data: { verifyId, tahun, signed: !!sig } });
      doc.save(`Laporan-SHU-${tahun}.pdf`);
      toast.success("Laporan PDF SHU diunduh");
  };

  if (!isPengurus) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">Hanya Ketua / Bendahara / Super Admin yang dapat mendistribusikan SHU.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-[#312b2b]"><Coins className="h-4 w-4" /> Distribusi SHU</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-[#2c2626]">Pembagian Sisa Hasil Usaha</h1>
        <p className="mt-1 text-sm text-[#3e3232]">Workflow: Bendahara hitung & usulkan → Ketua approve dengan tanda tangan digital.</p>
      </div>

      <Tabs defaultValue="kalkulasi">
        <TabsList>
          <TabsTrigger value="kalkulasi">Kalkulasi & Workflow</TabsTrigger>
          <TabsTrigger value="histori">Histori SHU ({history.length} tahun)</TabsTrigger>
        </TabsList>

        <TabsContent value="kalkulasi" className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Parameter</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Tahun Buku</Label><Input type="number" value={tahun} onChange={(e) => setTahun(Number(e.target.value))} /></div>
                <div><Label>Total SHU (Pool)</Label><Input type="number" value={pool} onChange={(e) => setPool(Number(e.target.value))} /><p className="mt-1 text-xs text-muted-foreground">{fmt(pool || 0)}</p></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Modal %</Label><Input type="number" value={jasaModal} onChange={(e) => setJasaModal(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Usaha %</Label><Input type="number" value={jasaUsaha} onChange={(e) => setJasaUsaha(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Cadangan %</Label><Input type="number" value={cadangan} onChange={(e) => setCadangan(Number(e.target.value))} /></div>
                </div>
                {totalPersen !== 100 && (
                  <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-2 text-xs"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> Total {totalPersen}% (harus 100%)</div>
                )}
                <div><Label>Catatan</Label><Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} /></div>

                {/* Workflow stage badge */}
                <div className="rounded-xl border p-3 text-sm">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Status Tahun {tahun}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {stage === "none" && <Badge variant="outline">Belum ada usulan</Badge>}
                    {stage === "draft" && <Badge className="bg-warning/20 text-warning-foreground">Menunggu Approval Ketua</Badge>}
                    {stage === "approved" && <Badge className="bg-success/20 text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Disetujui & Dibagikan</Badge>}
                  </div>
                </div>

                {/* Bendahara: propose */}
                {isBendahara && stage === "none" && (
                  <Button className="w-full" onClick={() => propose.mutate()} disabled={propose.isPending || totalPersen !== 100 || pool <= 0}>
                    <Send className="mr-2 h-4 w-4" /> Usulkan ke Ketua
                  </Button>
                )}

                {/* Ketua: approve / reject */}
                {isKetua && stage === "draft" && (
                  <div className="space-y-2">
                    <SignaturePadDialog
                      title="Tanda Tangani Approval SHU"
                      onSign={(s) => approve.mutateAsync(s)}
                      trigger={<Button className="w-full" disabled={approve.isPending}><ShieldCheck className="mr-2 h-4 w-4" /> Setujui & Bagikan (TTD)</Button>}
                    />
                    <Button variant="outline" className="w-full" onClick={() => reject.mutate()} disabled={reject.isPending}>Tolak Usulan</Button>
                  </div>
                )}

                {/* Export */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={exportShuExcel}><FileSpreadsheet className="mr-1 h-3 w-3" /> Excel</Button>
                  {isKetua && stage === "approved" ? (
                    <SignaturePadDialog title="Tanda Tangani Laporan PDF" onSign={(s) => exportShuPdf(s)} trigger={<Button variant="outline" size="sm"><FileText className="mr-1 h-3 w-3" /> PDF (TTD)</Button>} />
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => exportShuPdf()}><FileText className="mr-1 h-3 w-3" /> PDF</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Preview Pembagian — {distribusi.length} anggota</CardTitle>
                <p className="text-xs text-muted-foreground">Total simpanan: {fmt(totals.sumSimp)} · Total bunga: {fmt(totals.sumBunga)}</p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="max-h-[480px] overflow-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>No. Anggota</TableHead><TableHead>Nama</TableHead>
                        <TableHead className="text-right">Simpanan</TableHead><TableHead className="text-right">Bunga</TableHead>
                        <TableHead className="text-right">SHU</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(members ?? []).map((m) => {
                          const d = distribusi.find((x) => x.id === m.id);
                          return (
                            <TableRow key={m.id}>
                              <TableCell className="font-mono text-xs">{m.nomor}</TableCell>
                              <TableCell>{m.nama}</TableCell>
                              <TableCell className="text-right text-xs">{fmt(m.simpanan)}</TableCell>
                              <TableCell className="text-right text-xs">{fmt(m.bunga)}</TableCell>
                              <TableCell className="text-right font-semibold text-success">{fmt(d?.share ?? 0)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="histori" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Histori Distribusi SHU</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada distribusi SHU tercatat.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tahun</TableHead><TableHead className="text-right">Total Dibagikan</TableHead>
                    <TableHead className="text-right">Penerima</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.tahun}>
                        <TableCell className="font-bold">{h.tahun}</TableCell>
                        <TableCell className="text-right">{fmt(h.total)}</TableCell>
                        <TableCell className="text-right">{h.jumlah}</TableCell>
                        <TableCell>{h.status === "approved" ? <Badge className="bg-success/20 text-success-foreground">Dibagikan</Badge> : <Badge variant="outline">Draft</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
