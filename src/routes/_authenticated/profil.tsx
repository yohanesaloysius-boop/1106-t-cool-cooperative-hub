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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/file-upload";
import { StatusBadge } from "@/components/empty-state";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, User as UserIcon, IdCard, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";

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
  const { user, refresh, roles } = useAuth();
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
  const setFotoBg = async (bg: "transparent" | "white") => {
    await supabase.from("profiles").update({ foto_bg: bg } as never).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile-full"] });
    toast.success(bg === "white" ? "Latar foto: Putih" : "Latar foto: Transparan");
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
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <StatusBadge status={data.status} />
                  <Badge variant="secondary" className="gap-1 rounded-full text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> {roleLabel(roles)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <FileUpload bucket="avatars" userId={user!.id} label="Foto profil" hint="JPG/PNG, maks 4MB" publicBucket onUploaded={(r) => r.publicUrl && setAvatar(r.publicUrl)} />
              <FileUpload bucket="ktp" userId={user!.id} label="Foto KTP" hint="Disimpan privat untuk verifikasi pengurus" onUploaded={(r) => setKtp(r.path)} />
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-xs font-semibold">Latar foto kartu anggota</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={((data as { foto_bg?: string }).foto_bg ?? "white") === "white" ? "default" : "outline"} onClick={() => void setFotoBg("white")}>
                  Putih
                </Button>
                <Button type="button" size="sm" variant={((data as { foto_bg?: string }).foto_bg ?? "white") === "transparent" ? "default" : "outline"} onClick={() => void setFotoBg("transparent")}>
                  Transparan
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                <strong>Putih</strong> membuat semua kartu anggota seragam (disarankan).{" "}
                <strong>Transparan</strong> menampilkan latar gradien kartu di belakang foto.
              </p>
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
                <Select value={form.jenis_kelamin || "_none"} onValueChange={(v) => setForm((f) => ({ ...f, jenis_kelamin: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
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

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Ganti Password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Password minimal 8 karakter"); return; }
    if (pw !== pw2) { toast.error("Konfirmasi password tidak cocok"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password berhasil diganti");
    setPw(""); setPw2("");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
          Jika Anda masih menggunakan password standar dari pengurus, segera ganti dengan password pribadi Anda demi keamanan akun.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password Baru">
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min. 8 karakter" autoComplete="new-password" required />
        </Field>
        <Field label="Konfirmasi Password Baru">
          <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Ulangi password baru" autoComplete="new-password" required />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Ganti Password
        </Button>
      </div>
    </form>
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

function roleLabel(roles: AppRole[]): string {
  if (roles.includes("super_admin")) return "Super Admin";
  if (roles.includes("ketua")) return "Ketua";
  if (roles.includes("sekretaris")) return "Sekretaris";
  if (roles.includes("bendahara")) return "Bendahara";
  return "Anggota";
}
