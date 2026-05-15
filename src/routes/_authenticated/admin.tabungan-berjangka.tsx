import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tabungan-berjangka")({
  head: () => ({ meta: [{ title: "Admin · Tabungan Berjangka" }] }),
  component: Page,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function Page() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tabjangka-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabungan_berjangka")
        .select("*, profiles!tabungan_berjangka_user_id_fkey(nama_lengkap, nomor_anggota)")
        .order("created_at", { ascending: false });
      if (error) {
        const r = await supabase.from("tabungan_berjangka").select("*").order("created_at", { ascending: false });
        if (r.error) throw r.error;
        return r.data ?? [];
      }
      return data ?? [];
    },
  });

  const verify = useMutation({
    mutationFn: async (id: string) => {
      const today = new Date();
      const row = rows.find((r) => r.id === id);
      const jt = new Date(today);
      jt.setMonth(jt.getMonth() + (row?.tenor_bulan ?? 12));
      const { error } = await supabase
        .from("tabungan_berjangka")
        .update({
          status: "active",
          tanggal_mulai: today.toISOString().slice(0, 10),
          tanggal_jatuh_tempo: jt.toISOString().slice(0, 10),
          verified_at: today.toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tabungan diaktifkan");
      qc.invalidateQueries({ queryKey: ["tabjangka-admin"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tabungan Berjangka</h1>
        <p className="text-sm text-muted-foreground">Verifikasi dan kelola deposito anggota.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Daftar Tabungan</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pengajuan.</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="p-3 text-left">Tanggal</th>
                    <th className="p-3 text-left">Anggota</th>
                    <th className="p-3 text-right">Nominal</th>
                    <th className="p-3 text-center">Tenor</th>
                    <th className="p-3 text-center">Bunga</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3">{new Date(r.created_at).toLocaleDateString("id-ID")}</td>
                      <td className="p-3 text-xs text-muted-foreground">{r.user_id.slice(0, 8)}</td>
                      <td className="p-3 text-right font-medium">{fmt(Number(r.nominal))}</td>
                      <td className="p-3 text-center">{r.tenor_bulan} bln</td>
                      <td className="p-3 text-center">{r.bunga_persen}%</td>
                      <td className="p-3"><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></td>
                      <td className="p-3 text-right">
                        {r.status === "pending" && (
                          <Button size="sm" onClick={() => verify.mutate(r.id)} disabled={verify.isPending}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aktifkan
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
