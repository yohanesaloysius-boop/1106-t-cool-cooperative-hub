import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, ShieldAlert, Upload, ImageOff } from "lucide-react";

type Pengurus = { jabatan: string; nama: string; foto_url: string };

function PengurusEditor() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [list, setList] = useState<Pengurus[]>([]);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings-pengurus"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", "koperasi.pengurus").maybeSingle();
      if (error) throw error;
      return (data?.value as unknown as Pengurus[]) ?? [];
    },
  });

  useEffect(() => {
    if (data) setList(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: Pengurus[]) => {
      const { error } = await supabase.from("settings").update({ value: next as never }).eq("key", "koperasi.pengurus");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Struktur pengurus tersimpan");
      qc.invalidateQueries({ queryKey: ["settings-pengurus"] });
      qc.invalidateQueries({ queryKey: ["public-pengurus"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  const uploadFoto = async (idx: number, file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) return toast.error("Ukuran foto maksimal 4MB");
    setBusyIdx(idx);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/pengurus-${idx}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const next = list.map((p, i) => (i === idx ? { ...p, foto_url: url } : p));
      setList(next);
      toast.success("Foto diunggah");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyIdx(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Struktur Pengurus</CardTitle>
        <p className="text-xs text-muted-foreground">Nama & foto pengurus yang tampil di halaman utama.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {list.map((p, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-muted">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.jabatan} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageOff className="h-5 w-5" /></span>
                  )}
                </div>
                <div className="grid flex-1 gap-2">
                  <div>
                    <Label className="text-xs">Jabatan</Label>
                    <Input className="mt-1 h-8" value={p.jabatan} onChange={(e) => setList(list.map((x, i) => (i === idx ? { ...x, jabatan: e.target.value } : x)))} />
                  </div>
                  <div>
                    <Label className="text-xs">Nama</Label>
                    <Input className="mt-1 h-8" value={p.nama} placeholder="Nama lengkap" onChange={(e) => setList(list.map((x, i) => (i === idx ? { ...x, nama: e.target.value } : x)))} />
                  </div>
                  <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary">
                    {busyIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {p.foto_url ? "Ganti foto" : "Unggah foto"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFoto(idx, f); }} />
                  </label>
                </div>
              </div>
            ))}
            <Button onClick={() => save.mutate(list)} disabled={save.isPending} className="w-full">
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Struktur Pengurus
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/admin/pengaturan")({
  head: () => ({ meta: [{ title: "Pengaturan Koperasi" }] }),
  component: Page,
});

const GROUPS: { title: string; keys: { key: string; label: string; suffix?: string }[] }[] = [
  {
    title: "Rekening Koperasi",
    keys: [
      { key: "koperasi.bank_nama", label: "Nama bank", suffix: "teks" },
      { key: "koperasi.bank_rekening", label: "Nomor rekening", suffix: "teks" },
      { key: "koperasi.bank_atas_nama", label: "Atas nama", suffix: "teks" },
    ],
  },
  {
    title: "Pinjaman",
    keys: [
      { key: "pinjaman.bunga_persen", label: "Bunga pinjaman", suffix: "% / bulan" },
      { key: "pinjaman.tenor_max", label: "Tenor maksimum", suffix: "bulan" },
    ],
  },
  {
    title: "Simpanan",
    keys: [
      { key: "simpanan.pokok_min", label: "Simpanan pokok minimum", suffix: "Rp" },
      { key: "simpanan.wajib_bulanan", label: "Simpanan wajib bulanan", suffix: "Rp" },
    ],
  },
  {
    title: "Alokasi Pot SHU",
    keys: [
      { key: "shu.persen_jasa_modal", label: "Jasa modal", suffix: "%" },
      { key: "shu.persen_jasa_usaha", label: "Jasa usaha", suffix: "%" },
      { key: "shu.persen_dana_cadangan", label: "Dana cadangan", suffix: "%" },
      { key: "shu.persen_dana_sosial", label: "Dana sosial", suffix: "%" },
      { key: "shu.persen_pengurus", label: "Jasa pengurus", suffix: "%" },
    ],
  },
  {
    title: "Bobot SHU per Anggota",
    keys: [
      { key: "shu.bobot_simpanan_pokok", label: "Bobot simpanan pokok", suffix: "× nominal" },
      { key: "shu.bobot_simpanan_wajib", label: "Bobot simpanan wajib", suffix: "× nominal" },
      { key: "shu.bobot_simpanan_sukarela", label: "Bobot simpanan sukarela", suffix: "× nominal" },
      { key: "shu.bobot_jasa_pinjaman", label: "Bobot bunga pinjaman dibayar", suffix: "×" },
      { key: "shu.bobot_jasa_belanja", label: "Bobot belanja marketplace", suffix: "×" },
      { key: "shu.bobot_jasa_deposito", label: "Bobot tabungan berjangka", suffix: "×" },
      { key: "shu.min_keaktifan_persen", label: "Min. keaktifan", suffix: "% (di bawah → SHU 0)" },
      { key: "shu.penalti_tunggakan_persen", label: "Potongan jika ada tunggakan", suffix: "%" },
    ],
  },
  {
    title: "Bunga Tabungan Berjangka",
    keys: [
      { key: "tabungan_berjangka.bunga_3bln", label: "Tenor 3 bulan", suffix: "% / bulan" },
      { key: "tabungan_berjangka.bunga_6bln", label: "Tenor 6 bulan", suffix: "% / bulan" },
      { key: "tabungan_berjangka.bunga_12bln", label: "Tenor 12 bulan", suffix: "% / bulan" },
      { key: "tabungan_berjangka.bunga_24bln", label: "Tenor 24 bulan", suffix: "% / bulan" },
    ],
  },
  {
    title: "Reward Anggota",
    keys: [
      { key: "rewards.poin_setor_wajib", label: "Poin setor wajib tepat waktu", suffix: "poin" },
      { key: "rewards.poin_hadir_rapat", label: "Poin hadir rapat", suffix: "poin" },
      { key: "rewards.poin_lunas_pinjaman", label: "Poin pelunasan pinjaman", suffix: "poin" },
      { key: "rewards.poin_referral", label: "Poin referral aktif", suffix: "poin" },
      { key: "rewards.loyalitas_persen", label: "Bonus loyalitas", suffix: "% dari SHU dasar" },
    ],
  },
];

function Page() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["settings-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (data) {
      const v: Record<string, string> = {};
      data.forEach((row) => {
        v[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value).replace(/^"|"$/g, "");
      });
      setValues(v);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (key: string) => {
      const raw = values[key];
      const isText = key.startsWith("koperasi.");
      const num = Number(raw);
      const value = isText || isNaN(num) ? raw : num;
      const { error } = await supabase.from("settings").update({ value: value as never }).eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tersimpan");
      qc.invalidateQueries({ queryKey: ["settings-all"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center">
        <ShieldAlert className="mb-2 h-6 w-6 text-destructive" />
        <p className="font-semibold">Hanya Super Admin</p>
        <p className="text-xs text-muted-foreground">Pengaturan koperasi hanya bisa diubah super admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Koperasi</h1>
        <p className="text-sm text-muted-foreground">Atur bunga, persentase SHU, dan parameter lain.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <Card key={g.title}>
              <CardHeader><CardTitle className="text-base">{g.title}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {g.keys.map((k) => (
                  <div key={k.key} className="grid grid-cols-[1fr_auto] items-end gap-2">
                    <div>
                      <Label className="text-xs">{k.label} {k.suffix && <span className="text-muted-foreground">({k.suffix})</span>}</Label>
                      <Input
                        className="mt-1"
                        value={values[k.key] ?? ""}
                        onChange={(e) => setValues({ ...values, [k.key]: e.target.value })}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => save.mutate(k.key)} disabled={save.isPending}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
