import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, ShieldAlert, Upload, ImageOff, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type Pengurus = { jabatan: string; nama: string; foto_url: string };

const TENTANG_FIELDS: { key: string; label: string; hint?: string; rows?: number }[] = [
  { key: "tentang.makna_logo", label: "Makna Logo dan Nama", rows: 3 },
  { key: "tentang.visi", label: "Visi", rows: 2 },
  { key: "tentang.misi", label: "Misi (satu poin per baris)", rows: 4 },
  { key: "tentang.struktur_manajemen", label: "Struktur Manajemen (satu jabatan per baris)", rows: 4 },
  { key: "tentang.org_rapat_anggota", label: "Bagan: Rapat Anggota", rows: 1 },
  { key: "tentang.org_pengawas", label: "Bagan: Pengawas (satu per baris)", rows: 3 },
  { key: "tentang.org_pengurus", label: "Bagan: Pengurus (satu per baris)", rows: 5 },
  { key: "tentang.org_manajemen", label: "Bagan: Manajemen", rows: 1 },
  { key: "tentang.org_anggota", label: "Bagan: Anggota", rows: 1 },
  { key: "tentang.org_eksternal", label: "Bagan: Pihak Eksternal (satu per baris)", rows: 3 },
];

function TentangEditor() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoFit, setLogoFit] = useState<"contain" | "cover">("contain");

  const { data, isLoading } = useQuery({
    queryKey: ["settings-tentang"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value").like("key", "tentang.%");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logoData } = useQuery({
    queryKey: ["settings-logo"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("key,value").in("key", ["koperasi.logo_url", "koperasi.logo_fit"]);
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return {
        url: typeof map["koperasi.logo_url"] === "string" ? (map["koperasi.logo_url"] as string) : "",
        fit: (map["koperasi.logo_fit"] === "cover" ? "cover" : "contain") as "contain" | "cover",
      };
    },
  });

  useEffect(() => {
    if (logoData) {
      setLogoUrl(logoData.url);
      setLogoFit(logoData.fit);
    }
  }, [logoData]);

  useEffect(() => {
    if (data) {
      const v: Record<string, string> = {};
      data.forEach((row) => {
        v[row.key] = typeof row.value === "string" ? row.value : String(row.value ?? "");
      });
      setVals(v);
    }
  }, [data]);

  const uploadLogo = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran logo maksimal 2MB");
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    setLogoBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${user.id}/logo-koperasi-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error: sErr } = await supabase.from("settings").upsert({ key: "koperasi.logo_url", value: url as never }, { onConflict: "key" });
      if (sErr) throw sErr;
      setLogoUrl(url);
      toast.success("Logo koperasi tersimpan & tersinkron");
      qc.invalidateQueries({ queryKey: ["settings-logo"] });
      qc.invalidateQueries({ queryKey: ["koperasi-logo"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const { error } = await supabase.from("settings").upsert({ key: "koperasi.logo_url", value: "" as never }, { onConflict: "key" });
      if (error) throw error;
      setLogoUrl("");
      toast.success("Logo dihapus");
      qc.invalidateQueries({ queryKey: ["settings-logo"] });
      qc.invalidateQueries({ queryKey: ["koperasi-logo"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLogoBusy(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const f of TENTANG_FIELDS) {
        const { error } = await supabase.from("settings").upsert({ key: f.key, value: (vals[f.key] ?? "") as never }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Konten Tentang Kami tersimpan");
      qc.invalidateQueries({ queryKey: ["settings-tentang"] });
      qc.invalidateQueries({ queryKey: ["public-tentang"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Halaman "Tentang Kami"</CardTitle>
        <p className="text-xs text-muted-foreground">Konten yang tampil di halaman publik Tentang Kami.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="rounded-xl border border-border p-4">
              <Label className="text-xs font-semibold">Logo Koperasi</Label>
              <p className="mb-3 text-[11px] text-muted-foreground">Logo tersinkron otomatis ke header situs, halaman Makna Logo, surat resmi, dan dokumen AD/ART.</p>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo koperasi" className="h-full w-full object-contain" />
                  ) : (
                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    {logoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {logoUrl ? "Ganti logo" : "Unggah logo"}
                    <input type="file" accept="image/*" className="hidden" disabled={logoBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
                  </label>
                  {logoUrl && (
                    <Button size="sm" variant="ghost" className="w-fit text-destructive hover:text-destructive" onClick={() => void removeLogo()} disabled={logoBusy}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus logo
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">PNG/JPG transparan disarankan. Maks 2MB.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {TENTANG_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Textarea
                    className="mt-1"
                    rows={f.rows ?? 3}
                    value={vals[f.key] ?? ""}
                    onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Konten Tentang Kami
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
      const { error } = await supabase.from("settings").upsert({ key: "koperasi.pengurus", value: next as never }, { onConflict: "key" });
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

  const addRow = () => setList([...list, { jabatan: "", nama: "", foto_url: "" }]);
  const removeRow = (idx: number) => setList(list.filter((_, i) => i !== idx));
  const moveRow = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    setList(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Struktur Pengurus</CardTitle>
        <p className="text-xs text-muted-foreground">Nama & foto pengurus yang tampil di halaman utama. Tambah, hapus, atau urutkan jabatan sesuai kebutuhan.</p>
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
                <div className="flex shrink-0 flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveRow(idx, -1)} disabled={idx === 0} title="Naik">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveRow(idx, 1)} disabled={idx === list.length - 1} title="Turun">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(idx)} title="Hapus">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addRow} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Tambah Jabatan
            </Button>
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
          <PengurusEditor />
          <TentangEditor />
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
