import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Briefcase, Check, X, Trash2, Loader2, MapPin, Phone, Mail, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/lowongan")({
  head: () => ({ meta: [{ title: "Kelola Lowongan — T-COOL Admin" }] }),
  component: AdminLowonganPage,
});

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { label: "Disetujui", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  rejected: { label: "Ditolak", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  expired: { label: "Kadaluarsa", cls: "bg-muted text-muted-foreground" },
};

function AdminLowonganPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-lowongan", tab],
    queryFn: async () => {
      let q = supabase.from("lowongan_kerja").select("*").order("created_at", { ascending: false });
      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const patch = status === "approved"
        ? { status, approved_by: user!.id, approved_at: new Date().toISOString() }
        : { status };
      const { error } = await supabase.from("lowongan_kerja").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Lowongan disetujui" : "Lowongan ditolak");
      qc.invalidateQueries({ queryKey: ["admin-lowongan"] });
      qc.invalidateQueries({ queryKey: ["lowongan-approved"] });
      qc.invalidateQueries({ queryKey: ["public-lowongan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lowongan_kerja").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lowongan dihapus");
      qc.invalidateQueries({ queryKey: ["admin-lowongan"] });
      qc.invalidateQueries({ queryKey: ["lowongan-approved"] });
      qc.invalidateQueries({ queryKey: ["public-lowongan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold"><Briefcase className="h-4 w-4" /> Manajemen Lowongan Kerja</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold drop-shadow-sm text-[#292424]">Persetujuan Iklan Lowongan</h1>
        <p className="mt-1 text-sm opacity-90">Setujui atau tolak lowongan yang dipasang anggota.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">Menunggu</TabsTrigger>
          <TabsTrigger value="approved">Disetujui</TabsTrigger>
          <TabsTrigger value="rejected">Ditolak</TabsTrigger>
          <TabsTrigger value="all">Semua</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !data || data.length === 0 ? (
            <EmptyState icon={Briefcase} title="Tidak ada data" desc="Belum ada lowongan pada kategori ini." />
          ) : (
            <div className="space-y-3">
              {data.map((l) => {
                const st = STATUS_VARIANT[l.status] ?? STATUS_VARIANT.pending;
                return (
                  <Card key={l.id} style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{l.judul}</CardTitle>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" /> {l.perusahaan}
                            <span>·</span><span className="font-medium text-foreground">{l.posisi}</span>
                            {l.lokasi && <><span>·</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.lokasi}</span></>}
                          </div>
                        </div>
                        <Badge className={st.cls}>{st.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {l.deskripsi && <p className="text-foreground/80 whitespace-pre-line">{l.deskripsi}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {l.kontak_nama && <span>Kontak: <b className="text-foreground">{l.kontak_nama}</b></span>}
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.kontak_telepon}</span>
                        {l.kontak_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.kontak_email}</span>}
                        <span>Gender: {l.gender}</span>
                        {l.expired_at && <span>Berlaku s.d. {new Date(l.expired_at).toLocaleDateString("id-ID")}</span>}
                        <span>Dikirim: {new Date(l.created_at).toLocaleDateString("id-ID")}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {l.status !== "approved" && (
                          <Button size="sm" onClick={() => setStatus.mutate({ id: l.id, status: "approved" })} disabled={setStatus.isPending}>
                            <Check className="h-3.5 w-3.5" /> Setujui
                          </Button>
                        )}
                        {l.status !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "rejected" })} disabled={setStatus.isPending}>
                            <X className="h-3.5 w-3.5" /> Tolak
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Hapus lowongan ini?")) remove.mutate(l.id); }} disabled={remove.isPending}>
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
