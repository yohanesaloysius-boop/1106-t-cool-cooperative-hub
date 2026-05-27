import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Briefcase, MapPin, Phone, Mail, Building2, Loader2, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lowongan")({
  head: () => ({ meta: [{ title: "Lowongan Kerja — T-COOL Koperasi" }] }),
  component: LowonganPage,
});

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu Persetujuan", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { label: "Disetujui", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  rejected: { label: "Ditolak", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  expired: { label: "Kadaluarsa", cls: "bg-muted text-muted-foreground" },
};

function LowonganPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    judul: "",
    perusahaan: "",
    posisi: "",
    deskripsi: "",
    lokasi: "",
    gender: "pria/wanita",
    kontak_nama: "",
    kontak_telepon: "",
    kontak_email: "",
    expired_at: "",
  });

  const { data: approved, isLoading: loadingApproved } = useQuery({
    queryKey: ["lowongan-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lowongan_kerja")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mine, isLoading: loadingMine } = useQuery({
    queryKey: ["lowongan-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lowongan_kerja")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.judul.trim()) throw new Error("Judul wajib diisi");
      if (!form.perusahaan.trim()) throw new Error("Nama perusahaan wajib diisi");
      if (!form.posisi.trim()) throw new Error("Posisi wajib diisi");
      if (!form.kontak_telepon.trim()) throw new Error("Nomor telepon kontak wajib diisi");
      const { error } = await supabase.from("lowongan_kerja").insert({
        judul: form.judul.trim(),
        perusahaan: form.perusahaan.trim(),
        posisi: form.posisi.trim(),
        deskripsi: form.deskripsi.trim() || null,
        lokasi: form.lokasi.trim() || null,
        gender: form.gender,
        kontak_nama: form.kontak_nama.trim() || null,
        kontak_telepon: form.kontak_telepon.trim(),
        kontak_email: form.kontak_email.trim() || null,
        expired_at: form.expired_at || null,
        created_by: user!.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lowongan dikirim. Menunggu persetujuan admin.");
      setForm({ judul: "", perusahaan: "", posisi: "", deskripsi: "", lokasi: "", gender: "pria/wanita", kontak_nama: "", kontak_telepon: "", kontak_email: "", expired_at: "" });
      qc.invalidateQueries({ queryKey: ["lowongan-mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#393232]">
          <Briefcase className="h-4 w-4" /> Lowongan Kerja Komunitas
        </div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold text-[#2c2626]">Pasang & Cari Lowongan</h1>
        <p className="mt-1 text-sm opacity-90 text-[#272121]">Bantu anggota lain menemukan pekerjaan. Setiap iklan diverifikasi pengurus terlebih dahulu.</p>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Lowongan Tersedia</TabsTrigger>
          <TabsTrigger value="post">Pasang Lowongan</TabsTrigger>
          <TabsTrigger value="mine">Iklan Saya</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {loadingApproved ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !approved || approved.length === 0 ? (
            <EmptyState icon={Briefcase} title="Belum ada lowongan" desc="Saat ini belum ada lowongan yang disetujui." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {approved.map((l) => (
                <Card key={l.id} style={{ boxShadow: "var(--shadow-card)" }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{l.judul}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" /> {l.perusahaan}
                      <span>·</span>
                      <span className="font-medium text-foreground">{l.posisi}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {l.lokasi && <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {l.lokasi}</p>}
                    {l.deskripsi && <p className="text-foreground/80 line-clamp-3">{l.deskripsi}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary">{l.gender}</Badge>
                      {l.expired_at && <Badge variant="outline">Berlaku s.d. {new Date(l.expired_at).toLocaleDateString("id-ID")}</Badge>}
                    </div>
                    <div className="mt-3 border-t border-border pt-3 space-y-1 text-xs">
                      {l.kontak_nama && <p className="font-semibold">{l.kontak_nama}</p>}
                      <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> <a className="text-primary hover:underline" href={`tel:${l.kontak_telepon}`}>{l.kontak_telepon}</a></p>
                      {l.kontak_email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> <a className="text-primary hover:underline" href={`mailto:${l.kontak_email}`}>{l.kontak_email}</a></p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="post">
          <Card style={{ boxShadow: "var(--shadow-card)" }}>
            <CardHeader>
              <CardTitle className="text-base">Form Pasang Lowongan</CardTitle>
              <p className="text-xs text-muted-foreground">Iklan akan tampil setelah disetujui pengurus.</p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
                className="grid gap-4 md:grid-cols-2"
              >
                <div className="md:col-span-2">
                  <Label>Judul Iklan *</Label>
                  <Input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="Dibutuhkan Staff Admin" />
                </div>
                <div>
                  <Label>Nama Perusahaan *</Label>
                  <Input value={form.perusahaan} onChange={(e) => setForm({ ...form, perusahaan: e.target.value })} placeholder="PT Maju Bersama" />
                </div>
                <div>
                  <Label>Posisi *</Label>
                  <Input value={form.posisi} onChange={(e) => setForm({ ...form, posisi: e.target.value })} placeholder="Staff Administrasi" />
                </div>
                <div>
                  <Label>Lokasi</Label>
                  <Input value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} placeholder="Jakarta Selatan" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pria/wanita">Pria / Wanita</SelectItem>
                      <SelectItem value="pria">Pria</SelectItem>
                      <SelectItem value="wanita">Wanita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Deskripsi</Label>
                  <Textarea rows={4} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Tanggung jawab, kualifikasi, gaji, dst." />
                </div>
                <div>
                  <Label>Kontak (Nama)</Label>
                  <Input value={form.kontak_nama} onChange={(e) => setForm({ ...form, kontak_nama: e.target.value })} placeholder="HRD Ibu Ani" />
                </div>
                <div>
                  <Label>No. Telepon *</Label>
                  <Input value={form.kontak_telepon} onChange={(e) => setForm({ ...form, kontak_telepon: e.target.value })} placeholder="0812xxxx" />
                </div>
                <div>
                  <Label>Email Kontak</Label>
                  <Input type="email" value={form.kontak_email} onChange={(e) => setForm({ ...form, kontak_email: e.target.value })} placeholder="hrd@perusahaan.com" />
                </div>
                <div>
                  <Label>Berlaku Sampai</Label>
                  <Input type="date" value={form.expired_at} onChange={(e) => setForm({ ...form, expired_at: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={submit.isPending} className="w-full md:w-auto">
                    {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Kirim untuk Disetujui
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mine">
          {loadingMine ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !mine || mine.length === 0 ? (
            <EmptyState icon={Briefcase} title="Belum ada iklan" desc="Anda belum pernah memasang lowongan." />
          ) : (
            <div className="space-y-3">
              {mine.map((l) => {
                const st = STATUS_VARIANT[l.status] ?? STATUS_VARIANT.pending;
                return (
                  <Card key={l.id} style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-semibold">{l.judul}</p>
                        <p className="text-xs text-muted-foreground">{l.perusahaan} · {l.posisi}</p>
                      </div>
                      <Badge className={st.cls}>{st.label}</Badge>
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
