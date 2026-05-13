import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Coins, Calculator, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/shu")({
  head: () => ({ meta: [{ title: "Distribusi SHU — Admin" }] }),
  component: AdminShu,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const currentYear = new Date().getFullYear();

function AdminShu() {
  const { user, roles } = useAuth();
  const isPengurus = roles.some((r) => ["super_admin", "ketua", "bendahara"].includes(r));
  const qc = useQueryClient();

  const [tahun, setTahun] = useState<number>(currentYear - 1);
  const [pool, setPool] = useState<number>(0);
  const [jasaModal, setJasaModal] = useState<number>(40);
  const [jasaUsaha, setJasaUsaha] = useState<number>(40);
  const [cadangan, setCadangan] = useState<number>(20);
  const [catatan, setCatatan] = useState<string>("");

  // Existing SHU for the year
  const { data: existing } = useQuery({
    queryKey: ["shu-year", tahun],
    queryFn: async () => {
      const { data, error } = await supabase.from("shu").select("*").eq("tahun", tahun);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Members + their simpanan totals + bunga paid
  const { data: members, isLoading } = useQuery({
    queryKey: ["shu-base", tahun],
    queryFn: async () => {
      const start = `${tahun}-01-01`;
      const end = `${tahun}-12-31`;
      const [{ data: profs }, { data: simp }, { data: pj }] = await Promise.all([
        supabase.from("profiles").select("id,nomor_anggota,nama_lengkap").eq("status", "active"),
        supabase.from("simpanan").select("user_id,nominal,created_at").eq("status", "verified").lte("created_at", `${end}T23:59:59`),
        supabase.from("pinjaman").select("user_id,total_bayar,nominal,disbursed_at").in("status", ["disbursed", "completed", "approved"]).gte("disbursed_at", start).lte("disbursed_at", `${end}T23:59:59`),
      ]);
      const simpMap = new Map<string, number>();
      (simp ?? []).forEach((s) => simpMap.set(s.user_id, (simpMap.get(s.user_id) ?? 0) + Number(s.nominal)));
      const bungaMap = new Map<string, number>();
      (pj ?? []).forEach((p) => bungaMap.set(p.user_id, (bungaMap.get(p.user_id) ?? 0) + Math.max(0, Number(p.total_bayar ?? 0) - Number(p.nominal ?? 0))));
      return (profs ?? []).map((p) => ({
        id: p.id,
        nomor: p.nomor_anggota ?? "—",
        nama: p.nama_lengkap,
        simpanan: simpMap.get(p.id) ?? 0,
        bunga: bungaMap.get(p.id) ?? 0,
      }));
    },
  });

  const totals = useMemo(() => {
    const sumSimp = (members ?? []).reduce((a, b) => a + b.simpanan, 0);
    const sumBunga = (members ?? []).reduce((a, b) => a + b.bunga, 0);
    return { sumSimp, sumBunga };
  }, [members]);

  const totalPersen = jasaModal + jasaUsaha + cadangan;
  const poolAnggota = pool * ((jasaModal + jasaUsaha) / 100);
  const poolModal = pool * (jasaModal / 100);
  const poolUsaha = pool * (jasaUsaha / 100);

  const distribusi = useMemo(() => {
    if (!members?.length || pool <= 0) return [] as { id: string; nomor: string; nama: string; share: number }[];
    return members.map((m) => {
      const m1 = totals.sumSimp > 0 ? (m.simpanan / totals.sumSimp) * poolModal : 0;
      const m2 = totals.sumBunga > 0 ? (m.bunga / totals.sumBunga) * poolUsaha : 0;
      return { id: m.id, nomor: m.nomor, nama: m.nama, share: Math.round(m1 + m2) };
    });
  }, [members, totals, poolModal, poolUsaha, pool]);

  const distribute = useMutation({
    mutationFn: async () => {
      if (!isPengurus) throw new Error("Akses ditolak");
      if (pool <= 0) throw new Error("Pool SHU harus > 0");
      if (totalPersen !== 100) throw new Error("Total persentase harus 100%");
      if (existing && existing.length > 0) throw new Error(`SHU tahun ${tahun} sudah pernah dibagikan`);
      const rows = distribusi.filter((d) => d.share > 0).map((d) => ({
        user_id: d.id,
        tahun,
        nominal: d.share,
        catatan: catatan || `Pembagian SHU tahun buku ${tahun}`,
        dibagikan_at: new Date().toISOString(),
        created_by: user?.id,
      }));
      if (!rows.length) throw new Error("Tidak ada anggota dengan kontribusi");
      const { error } = await supabase.from("shu").insert(rows);
      if (error) throw error;
      // Notifications
      await supabase.from("notifications").insert(rows.map((r) => ({
        user_id: r.user_id,
        judul: `SHU Tahun ${tahun} Diterima`,
        pesan: `Anda menerima SHU sebesar ${fmt(Number(r.nominal))} untuk tahun buku ${tahun}.`,
        kategori: "success" as const,
        url: "/shu",
        ref_table: "shu",
      })));
      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        action: "shu.distribute",
        entity: "shu",
        new_data: { tahun, pool, jasaModal, jasaUsaha, cadangan, anggota: rows.length },
      });
    },
    onSuccess: () => {
      toast.success(`SHU tahun ${tahun} berhasil dibagikan`);
      qc.invalidateQueries({ queryKey: ["shu-year", tahun] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isPengurus) {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">Hanya Ketua / Bendahara / Super Admin yang dapat mendistribusikan SHU.</div>;
  }

  const alreadyDistributed = (existing?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm text-white/80"><Coins className="h-4 w-4" /> Distribusi SHU</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold">Pembagian Sisa Hasil Usaha</h1>
        <p className="mt-1 text-sm text-white/80">Hitung & bagikan SHU per anggota berdasarkan jasa modal & jasa usaha.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Parameter</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Tahun Buku</Label>
              <Input type="number" value={tahun} onChange={(e) => setTahun(Number(e.target.value))} />
            </div>
            <div>
              <Label>Total SHU (Pool)</Label>
              <Input type="number" value={pool} onChange={(e) => setPool(Number(e.target.value))} placeholder="0" />
              <p className="mt-1 text-xs text-muted-foreground">{fmt(pool || 0)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Jasa Modal %</Label><Input type="number" value={jasaModal} onChange={(e) => setJasaModal(Number(e.target.value))} /></div>
              <div><Label className="text-xs">Jasa Usaha %</Label><Input type="number" value={jasaUsaha} onChange={(e) => setJasaUsaha(Number(e.target.value))} /></div>
              <div><Label className="text-xs">Cadangan %</Label><Input type="number" value={cadangan} onChange={(e) => setCadangan(Number(e.target.value))} /></div>
            </div>
            {totalPersen !== 100 && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-2 text-xs text-warning-foreground"><AlertTriangle className="h-4 w-4 shrink-0" /> Total persentase: {totalPersen}% (harus 100%)</div>
            )}
            <div>
              <Label>Catatan</Label>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan distribusi (opsional)" />
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Pool Anggota</span><span className="font-semibold">{fmt(poolAnggota)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">— Jasa Modal</span><span>{fmt(poolModal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">— Jasa Usaha</span><span>{fmt(poolUsaha)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cadangan</span><span>{fmt(pool * (cadangan / 100))}</span></div>
            </div>
            {alreadyDistributed && (
              <Badge variant="secondary" className="w-full justify-center py-2">SHU tahun {tahun} sudah dibagikan ({existing?.length ?? 0} entri)</Badge>
            )}
            <Button className="w-full" onClick={() => distribute.mutate()} disabled={distribute.isPending || alreadyDistributed || totalPersen !== 100 || pool <= 0}>
              <Send className="mr-2 h-4 w-4" /> Distribusikan SHU
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Preview Pembagian — {distribusi.length} anggota</CardTitle>
            <p className="text-xs text-muted-foreground">Total simpanan terverifikasi: {fmt(totals.sumSimp)} · Total bunga {tahun}: {fmt(totals.sumBunga)}</p>
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
    </div>
  );
}
