import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/empty-state";
import { Loader2, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/angsuran")({
  head: () => ({ meta: [{ title: "Verifikasi Pembayaran — T-COOL Koperasi" }] }),
  component: AdminAngsuranPage,
});

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type Row = {
  id: string; user_id: string; pinjaman_id: string; cicilan_ke: number;
  nominal: number; jatuh_tempo: string; bukti_url: string | null;
  status: "unpaid" | "pending" | "paid" | "overdue"; paid_at: string | null;
  profiles: { nama_lengkap: string | null; nomor_anggota: string | null } | null;
};

export function AdminAngsuranPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState("pending");

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["admin-angsuran"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("angsuran")
        .select("id,user_id,pinjaman_id,cicilan_ke,nominal,jatuh_tempo,bukti_url,status,paid_at, profiles:user_id(nama_lengkap,nomor_anggota)")
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("admin-angsuran-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "angsuran" },
        () => qc.invalidateQueries({ queryKey: ["admin-angsuran"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const today = new Date();
  const lists = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    const overdue = rows.filter((r) => r.status === "unpaid" && new Date(r.jatuh_tempo) < today);
    const paid = rows.filter((r) => r.status === "paid");
    return { pending, overdue, paid };
  }, [rows]);

  const totalOverdue = lists.overdue.reduce((s, r) => s + Number(r.nominal), 0);
  const totalPending = lists.pending.reduce((s, r) => s + Number(r.nominal), 0);

  const verify = useMutation({
    mutationFn: async ({ row, status }: { row: Row; status: "paid" | "rejected" }) => {
      if (status === "paid") {
        const { error } = await supabase.from("angsuran").update({ status: "paid", paid_at: row.paid_at ?? new Date().toISOString(), updated_by: user?.id ?? null }).eq("id", row.id);
        if (error) throw error;
        await supabase.from("transaksi").insert({
          user_id: row.user_id, jenis: "angsuran_masuk", arah: "kredit", nominal: row.nominal,
          ref_table: "angsuran", ref_id: row.id, keterangan: `Pembayaran cicilan #${row.cicilan_ke}`,
        });
        await supabase.from("notifications").insert({
          user_id: row.user_id, judul: "Pembayaran Diverifikasi",
          pesan: `Cicilan #${row.cicilan_ke} sebesar ${fmt.format(Number(row.nominal))} telah diverifikasi.`,
          kategori: "sukses", url: "/angsuran",
        });
      } else {
        const { error } = await supabase.from("angsuran").update({ status: "unpaid", bukti_url: null, paid_at: null, updated_by: user?.id ?? null }).eq("id", row.id);
        if (error) throw error;
        await supabase.from("notifications").insert({
          user_id: row.user_id, judul: "Pembayaran Ditolak",
          pesan: `Bukti cicilan #${row.cicilan_ke} ditolak. Silakan upload ulang.`,
          kategori: "peringatan", url: "/angsuran",
        });
      }
      await supabase.from("audit_logs").insert({
        actor_id: user?.id ?? null, action: `angsuran.${status === "paid" ? "verified" : "rejected"}`,
        entity: "angsuran", entity_id: row.id, new_data: { nominal: row.nominal, cicilan_ke: row.cicilan_ke },
      });
    },
    onSuccess: (_, v) => { toast.success(v.status === "paid" ? "Pembayaran diverifikasi" : "Pembayaran ditolak"); qc.invalidateQueries({ queryKey: ["admin-angsuran"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remind = useMutation({
    mutationFn: async (row: Row) => {
      await supabase.from("notifications").insert({
        user_id: row.user_id, judul: "Pengingat Tagihan",
        pesan: `Cicilan #${row.cicilan_ke} sebesar ${fmt.format(Number(row.nominal))} sudah lewat jatuh tempo (${new Date(row.jatuh_tempo).toLocaleDateString("id-ID")}).`,
        kategori: "peringatan", url: "/angsuran",
      });
    },
    onSuccess: () => toast.success("Pengingat dikirim"),
    onError: (e: Error) => toast.error(e.message),
  });

  const viewBukti = async (path: string) => {
    const { data, error } = await supabase.storage.from("ktp").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("Tidak bisa membuka bukti"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const renderTable = (list: Row[], variant: "pending" | "overdue" | "paid") => {
    if (list.length === 0) return <EmptyState title={variant === "pending" ? "Tidak ada pembayaran menunggu" : variant === "overdue" ? "Tidak ada tunggakan" : "Belum ada pembayaran lunas"} />;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead>Cicilan</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.paid_at ? new Date(r.paid_at).toLocaleString("id-ID") : "—"}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{r.profiles?.nama_lengkap ?? "—"}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{r.profiles?.nomor_anggota ?? ""}</div>
                </TableCell>
                <TableCell className="text-xs">#{r.cicilan_ke}</TableCell>
                <TableCell className="text-xs">{new Date(r.jatuh_tempo).toLocaleDateString("id-ID")}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{fmt.format(Number(r.nominal))}</TableCell>
                <TableCell><StatusBadge status={variant === "overdue" ? "overdue" : r.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.bukti_url && (
                      <Button size="sm" variant="ghost" onClick={() => viewBukti(r.bukti_url!)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {variant === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => verify.mutate({ row: r, status: "paid" })}>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => verify.mutate({ row: r, status: "rejected" })}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {variant === "overdue" && (
                      <Button size="sm" variant="outline" onClick={() => remind.mutate(r)}>Ingatkan</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verifikasi Pembayaran Angsuran</h1>
        <p className="text-sm text-muted-foreground">Tinjau bukti transfer anggota & pantau tunggakan secara realtime.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{lists.pending.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fmt.format(totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30" style={{ boxShadow: "var(--shadow-card)" }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-destructive">{lists.overdue.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fmt.format(totalOverdue)}</p>
          </CardContent>
        </Card>
        <Card style={{ boxShadow: "var(--shadow-card)" }}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Lunas</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{lists.paid.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader><CardTitle className="text-base">Daftar Pembayaran</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="pending">Menunggu ({lists.pending.length})</TabsTrigger>
                <TabsTrigger value="overdue">Overdue ({lists.overdue.length})</TabsTrigger>
                <TabsTrigger value="paid">Lunas ({lists.paid.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-4">{renderTable(lists.pending, "pending")}</TabsContent>
              <TabsContent value="overdue" className="mt-4">{renderTable(lists.overdue, "overdue")}</TabsContent>
              <TabsContent value="paid" className="mt-4">{renderTable(lists.paid, "paid")}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
