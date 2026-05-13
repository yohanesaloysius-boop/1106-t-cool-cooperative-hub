import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Upload, FileText, ExternalLink, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dokumen")({
  head: () => ({ meta: [{ title: "Dokumen Saya — T-COOL Koperasi" }] }),
  component: DokumenPage,
});

const KATEGORI = ["KTP", "KK", "Slip Gaji", "NPWP", "Lainnya"];

function DokumenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("KTP");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-docs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,nama,kategori,file_url,mime,ukuran,created_at")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!nama.trim()) throw new Error("Nama dokumen wajib diisi");
      if (file.size > 8 * 1024 * 1024) throw new Error("Maks 8MB");
      setBusy(true);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("ktp").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("documents").insert({
        user_id: user!.id, nama: nama.trim(), kategori, file_url: path, mime: file.type, ukuran: file.size,
      });
      if (insErr) throw insErr;
      await supabase.from("audit_logs").insert({ actor_id: user!.id, entity: "documents", action: "upload", new_data: { nama, kategori, path } });
    },
    onSuccess: () => {
      toast.success("Dokumen diunggah");
      setNama(""); if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["my-docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("ktp").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dokumen Saya</h1>
        <p className="text-sm text-muted-foreground">Unggah dokumen pendukung untuk verifikasi keanggotaan & pinjaman.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Unggah Dokumen</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama dokumen</Label>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="cth. Slip Gaji Mei" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={kategori} onChange={(e) => setKategori(e.target.value)}>
                {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File (PDF/Gambar, maks 8MB)</Label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
              <Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Pilih file
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Daftar Dokumen ({data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !data?.length ? (
            <EmptyState title="Belum ada dokumen" desc="Unggah KTP, KK, atau dokumen pendukung lainnya." icon={FileText} />
          ) : (
            <div className="divide-y divide-border">
              {data.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.nama}</p>
                      <p className="text-[11px] text-muted-foreground">{d.kategori} · {((d.ukuran ?? 0) / 1024).toFixed(0)} KB · {new Date(d.created_at).toLocaleDateString("id-ID")}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openDoc(d.file_url)}>
                    <ExternalLink className="h-3.5 w-3.5" /> Buka
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
