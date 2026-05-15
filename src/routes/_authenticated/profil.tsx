import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/file-upload";
import { StatusBadge } from "@/components/empty-state";
import { Loader2, Save, User as UserIcon, IdCard, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profil Anggota — T-COOL Koperasi" }] }),
  component: ProfilPage,
});

const schema = z.object({
  nama_lengkap: z.string().trim().min(3).max(120),
  no_hp: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "Nomor HP tidak valid"),
  nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit").optional().or(z.literal("")),
  alamat: z.string().trim().max(300).optional().or(z.literal("")),
  tempat_lahir: z.string().trim().max(60).optional().or(z.literal("")),
  tanggal_lahir: z.string().optional().or(z.literal("")),
  jenis_kelamin: z.string().optional().or(z.literal("")),
  pekerjaan: z.string().trim().max(60).optional().or(z.literal("")),
});

function ProfilPage() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["profile-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) {
      setForm({
        nama_lengkap: data.nama_lengkap ?? "",
        no_hp: data.no_hp ?? "",
        nik: data.nik ?? "",
        alamat: data.alamat ?? "",
        tempat_lahir: data.tempat_lahir ?? "",
        tanggal_lahir: data.tanggal_lahir ?? "",
        jenis_kelamin: data.jenis_kelamin ?? "",
        pekerjaan: data.pekerjaan ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const parsed = schema.parse(payload);
      const update = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v === "" ? null : v]));
      const { error } = await supabase.from("profiles").update(update as never).eq("id", user!.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user!.id, entity: "profiles", entity_id: user!.id,
        action: "update_profile", new_data: update,
      });
    },
    onSuccess: () => {
      toast.success("Profil tersimpan");
      qc.invalidateQueries({ queryKey: ["profile-full"] });
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setAvatar = async (publicUrl: string) => {
    await supabase.from("profiles").update({ foto_url: publicUrl }).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile-full"] });
    void refresh();
  };
  const setKtp = async (path: string) => {
    await supabase.from("profiles").update({ ktp_url: path }).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile-full"] });
  };

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  const initials = (data.nama_lengkap ?? "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Anggota</h1>
        <p className="text-sm text-muted-foreground">Kelola data pribadi & dokumen Anda.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Identitas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                <AvatarImage src={data.foto_url ?? undefined} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold">{data.nama_lengkap}</p>
                <p className="font-mono text-xs text-muted-foreground">{data.nomor_anggota ?? "—"}</p>
                <div className="mt-2"><StatusBadge status={data.status} /></div>
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <FileUpload bucket="avatars" userId={user!.id} label="Foto profil" hint="JPG/PNG, maks 4MB" publicBucket onUploaded={(r) => r.publicUrl && setAvatar(r.publicUrl)} />
              <FileUpload bucket="ktp" userId={user!.id} label="Foto KTP" hint="Disimpan privat untuk verifikasi pengurus" onUploaded={(r) => setKtp(r.path)} />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground"><IdCard className="h-3.5 w-3.5" /> Status Kartu</div>
              <p className="mt-1">{data.member_card_number ?? "Belum diterbitkan"} · {data.card_status}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserIcon className="h-4 w-4" /> Data Pribadi</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
            >
              <Field label="Nama Lengkap"><Input value={form.nama_lengkap ?? ""} onChange={(e) => setForm((f) => ({ ...f, nama_lengkap: e.target.value }))} required /></Field>
              <Field label="No. HP"><Input value={form.no_hp ?? ""} onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))} required /></Field>
              <Field label="NIK"><Input value={form.nik ?? ""} maxLength={16} onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value }))} /></Field>
              <Field label="Pekerjaan"><Input value={form.pekerjaan ?? ""} onChange={(e) => setForm((f) => ({ ...f, pekerjaan: e.target.value }))} /></Field>
              <Field label="Tempat Lahir"><Input value={form.tempat_lahir ?? ""} onChange={(e) => setForm((f) => ({ ...f, tempat_lahir: e.target.value }))} /></Field>
              <Field label="Tanggal Lahir"><Input type="date" value={form.tanggal_lahir ?? ""} onChange={(e) => setForm((f) => ({ ...f, tanggal_lahir: e.target.value }))} /></Field>
              <Field label="Jenis Kelamin">
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.jenis_kelamin ?? ""} onChange={(e) => setForm((f) => ({ ...f, jenis_kelamin: e.target.value }))}>
                  <option value="">—</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Email"><Input value={data.email ?? ""} disabled /></Field>
              <div className="sm:col-span-2"><Field label="Alamat"><Textarea rows={3} value={form.alamat ?? ""} onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))} /></Field></div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={save.isPending} className="gap-2">
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
