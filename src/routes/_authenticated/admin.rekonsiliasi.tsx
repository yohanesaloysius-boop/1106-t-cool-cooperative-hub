import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Upload, Link2, X, CheckCircle2, Banknote, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rekonsiliasi")({
  head: () => ({ meta: [{ title: "Rekonsiliasi Pembayaran — Admin" }] }),
  component: RekonsiliasiPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

// CSV parser sederhana yang menerima format umum: tanggal,keterangan,debit,kredit,saldo
// Header fleksibel: deteksi kolom dari nama header
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitLine = (l: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (const ch of l) {
      if (ch === '"') { q = !q; continue; }
      if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => {
    const cols = splitLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
    return obj;
  });
}

function pickField(row: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    for (const k of Object.keys(row)) if (k.includes(c)) return row[k];
  }
  return "";
}

function parseNominal(s: string): number {
  if (!s) return 0;
  const n = Number(s.replace(/[^0-9.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, ""));
  return isFinite(n) ? n : 0;
}

function parseTanggal(s: string): string | null {
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m2) {
    const dd = m2[1].padStart(2, "0"); const mm = m2[2].padStart(2, "0");
    let yy = m2[3]; if (yy.length === 2) yy = (Number(yy) > 50 ? "19" : "20") + yy;
    return `${yy}-${mm}-${dd}`;
  }
  return null;
}

function RekonsiliasiPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bankName, setBankName] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bank-mutations"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_mutations" as any)
        .select("*")
        .order("tanggal", { ascending: false })
        .limit(500));
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) throw new Error("File CSV kosong atau format tidak dikenali.");
      const records = parsed.map((row) => {
        const tanggal = parseTanggal(pickField(row, ["tanggal", "date"]));
        const ket = pickField(row, ["keterangan", "uraian", "description", "narasi"]) || "-";
        const debit = parseNominal(pickField(row, ["debit"]));
        const kredit = parseNominal(pickField(row, ["kredit", "credit"]));
        const saldo = parseNominal(pickField(row, ["saldo", "balance"]));
        const nominal = kredit > 0 ? kredit : debit;
        const jenis = kredit > 0 ? "kredit" : "debit";
        return tanggal && nominal > 0 ? {
          tanggal, keterangan: ket, nominal, jenis, saldo: saldo || null,
          bank_name: bankName || null, source_file: file.name, raw_row: row,
          created_by: user!.id, status: "unmatched",
        } : null;
      }).filter(Boolean);
      if (!records.length) throw new Error("Tidak ada baris mutasi valid yang ditemukan.");
      const { error } = await (supabase.from("bank_mutations" as any).insert(records as any));
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} baris mutasi diimpor`);
      qc.invalidateQueries({ queryKey: ["bank-mutations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matchMut = useMutation({
    mutationFn: async ({ mut, target }: { mut: any; target: { table: "simpanan" | "angsuran"; id: string; user_id: string } }) => {
      // Update bank_mutation
      const { error: e1 } = await (supabase.from("bank_mutations" as any).update({
        status: "matched", matched_table: target.table, matched_id: target.id,
        matched_by: user!.id, matched_at: new Date().toISOString(),
      }).eq("id", mut.id));
      if (e1) throw e1;

      // Auto-verify simpanan or mark angsuran as paid
      if (target.table === "simpanan") {
        const { error } = await supabase.from("simpanan").update({
          status: "verified", verified_at: new Date().toISOString(), verified_by: user!.id,
          catatan: `Tercocokkan otomatis dengan mutasi bank ${mut.tanggal}`,
        }).eq("id", target.id);
        if (error) throw error;
        await supabase.from("transaksi").insert({
          user_id: target.user_id, jenis: "simpanan_masuk", arah: "kredit",
          nominal: mut.nominal, ref_table: "simpanan", ref_id: target.id,
          keterangan: "Setoran (rekonsiliasi bank)",
        });
      } else {
        const { error } = await supabase.from("angsuran").update({
          status: "paid", paid_at: new Date().toISOString(),
        }).eq("id", target.id);
        if (error) throw error;
        await supabase.from("transaksi").insert({
          user_id: target.user_id, jenis: "angsuran_bayar", arah: "kredit",
          nominal: mut.nominal, ref_table: "angsuran", ref_id: target.id,
          keterangan: "Pembayaran angsuran (rekonsiliasi bank)",
        });
      }
      await supabase.from("notifications").insert({
        user_id: target.user_id,
        judul: target.table === "simpanan" ? "Setoran Terverifikasi" : "Angsuran Diterima",
        pesan: `${fmt.format(mut.nominal)} dicocokkan dengan mutasi bank ${mut.tanggal}.`,
        kategori: "sukses",
      });
    },
    onSuccess: () => {
      toast.success("Mutasi dicocokkan");
      qc.invalidateQueries({ queryKey: ["bank-mutations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ignoreMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("bank_mutations" as any).update({ status: "ignored" }).eq("id", id));
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Diabaikan"); qc.invalidateQueries({ queryKey: ["bank-mutations"] }); },
  });

  const unmatched = useMemo(() => rows.filter((r) => r.status === "unmatched"), [rows]);
  const matched = useMemo(() => rows.filter((r) => r.status === "matched"), [rows]);
  const ignored = useMemo(() => rows.filter((r) => r.status === "ignored"), [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Banknote className="h-6 w-6 text-primary" /> Rekonsiliasi Pembayaran</h1>
        <p className="text-sm text-muted-foreground">Unggah mutasi rekening bank (CSV) lalu cocokkan dengan setoran simpanan atau angsuran pinjaman.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Impor Mutasi Bank (CSV)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Nama bank (opsional)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Input ref={fileRef} type="file" accept=".csv,text/csv" className="sm:col-span-2" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) importMut.mutate(f);
              if (fileRef.current) fileRef.current.value = "";
            }} />
          </div>
          <p className="text-xs text-muted-foreground">
            <FileText className="inline h-3 w-3" /> Format kolom yang dikenali: <code>tanggal, keterangan, debit, kredit, saldo</code>. Header bisa berbahasa Indonesia atau Inggris.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Mutasi ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <EmptyState title="Belum ada mutasi" desc="Unggah file CSV mutasi dari bank koperasi." />
          ) : (
            <Tabs defaultValue="unmatched">
              <TabsList>
                <TabsTrigger value="unmatched">Belum Cocok ({unmatched.length})</TabsTrigger>
                <TabsTrigger value="matched">Sudah Cocok ({matched.length})</TabsTrigger>
                <TabsTrigger value="ignored">Diabaikan ({ignored.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="unmatched" className="mt-3">
                <MutationList rows={unmatched} onMatch={(mut, target) => matchMut.mutate({ mut, target })} onIgnore={(id) => ignoreMut.mutate(id)} canAct />
              </TabsContent>
              <TabsContent value="matched" className="mt-3"><MutationList rows={matched} /></TabsContent>
              <TabsContent value="ignored" className="mt-3"><MutationList rows={ignored} /></TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MutationList({
  rows, onMatch, onIgnore, canAct,
}: {
  rows: any[];
  onMatch?: (mut: any, target: { table: "simpanan" | "angsuran"; id: string; user_id: string }) => void;
  onIgnore?: (id: string) => void;
  canAct?: boolean;
}) {
  if (!rows.length) return <EmptyState title="Tidak ada data" />;
  return (
    <div className="space-y-3">
      {rows.map((m) => (
        <MutationCard key={m.id} mut={m} onMatch={onMatch} onIgnore={onIgnore} canAct={canAct} />
      ))}
    </div>
  );
}

function MutationCard({ mut, onMatch, onIgnore, canAct }: any) {
  const [open, setOpen] = useState(false);
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["match-candidates", mut.id, mut.nominal, mut.tanggal],
    enabled: open && canAct,
    queryFn: async () => {
      // ± 7 hari, nominal sama persis
      const d = new Date(mut.tanggal);
      const from = new Date(d.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const to = new Date(d.getTime() + 7 * 86400000).toISOString();
      const [simp, ang] = await Promise.all([
        supabase.from("simpanan").select("id,user_id,jenis,nominal,created_at,status,profiles:user_id(nama_lengkap,nomor_anggota)")
          .eq("status", "pending").eq("nominal", mut.nominal).gte("created_at", from).lte("created_at", to).limit(10),
        supabase.from("angsuran").select("id,user_id,nominal,jatuh_tempo,status,profiles:user_id(nama_lengkap,nomor_anggota)" as any)
          .in("status", ["unpaid", "overdue"]).eq("nominal", mut.nominal).limit(10),
      ]);
      return [
        ...(simp.data ?? []).map((s: any) => ({ kind: "simpanan" as const, ...s, label: `Simpanan ${s.jenis} · ${s.profiles?.nama_lengkap ?? "—"}` })),
        ...(ang.data ?? []).map((a: any) => ({ kind: "angsuran" as const, ...a, label: `Angsuran · ${a.profiles?.nama_lengkap ?? "—"} (jt: ${a.jatuh_tempo})` })),
      ];
    },
  });

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mut.jenis === "kredit" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {mut.jenis.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">{mut.tanggal}</span>
            {mut.bank_name && <span className="text-[10px] text-muted-foreground">· {mut.bank_name}</span>}
          </div>
          <p className="font-semibold">{fmt.format(Number(mut.nominal))}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">{mut.keterangan}</p>
          {mut.matched_table && (
            <p className="text-[11px] text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Tercocokkan ke {mut.matched_table}</p>
          )}
        </div>
        {canAct && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
              <Link2 className="h-3 w-3" /> Cocokkan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onIgnore?.(mut.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {open && canAct && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Tidak ada kandidat dengan nominal {fmt.format(mut.nominal)} dalam ±7 hari.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Jenis</TableHead><TableHead>Anggota</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {candidates.map((c: any) => (
                  <TableRow key={`${c.kind}-${c.id}`}>
                    <TableCell className="text-xs">{c.label}</TableCell>
                    <TableCell className="text-xs font-mono">{c.profiles?.nomor_anggota ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => onMatch?.(mut, { table: c.kind, id: c.id, user_id: c.user_id })}>
                        <CheckCircle2 className="h-3 w-3" /> Cocokkan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
