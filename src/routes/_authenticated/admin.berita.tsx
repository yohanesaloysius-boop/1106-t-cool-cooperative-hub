import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadFile } from "@/lib/upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Newspaper, Plus, Pencil, Trash2, Loader2, Eye, EyeOff, ImageUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/berita")({
  head: () => ({ meta: [{ title: "Berita & Kegiatan — T-COOL Admin" }] }),
  component: AdminBeritaPage,
});

type Berita = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_url: string | null;
  category: string;
  status: string;
  published_at: string | null;
  created_at: string;
};

const CATEGORIES = ["Kegiatan", "Pengumuman", "Prestasi", "Rapat", "Umum"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

type FormState = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_url: string;
  category: string;
  status: string;
};

const EMPTY: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_url: "",
  category: "Kegiatan",
  status: "draft",
};

function AdminBeritaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-berita"],
    queryFn: async (): Promise<Berita[]> => {
      const { data, error } = await supabase
        .from("berita")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Berita[];
    },
  });

  const items = data ?? [];
  const isEdit = !!form.id;

  const effectiveSlug = useMemo(
    () => (slugTouched ? slugify(form.slug) : slugify(form.title)),
    [slugTouched, form.slug, form.title],
  );

  function openNew() {
    setForm(EMPTY);
    setSlugTouched(false);
    setOpen(true);
  }
  function openEdit(b: Berita) {
    setForm({
      id: b.id,
      title: b.title,
      slug: b.slug,
      excerpt: b.excerpt ?? "",
      content: b.content,
      cover_url: b.cover_url ?? "",
      category: b.category,
      status: b.status,
    });
    setSlugTouched(true);
    setOpen(true);
  }

  async function handleCover(file: File) {
    if (!user) return;
    setUploading(true);
    const res = await uploadFile(file, "berita", { userId: user.id, folder: "berita" });
    setUploading(false);
    if (res?.publicUrl) {
      setForm((f) => ({ ...f, cover_url: res.publicUrl! }));
      toast.success("Gambar diunggah");
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Tidak ada sesi");
      const title = form.title.trim();
      const content = form.content.trim();
      if (!title) throw new Error("Judul wajib diisi");
      if (!content) throw new Error("Isi berita wajib diisi");
      const slug = effectiveSlug || slugify(title) || `berita-${Date.now()}`;
      const payload = {
        title,
        slug,
        excerpt: form.excerpt.trim() || null,
        content,
        cover_url: form.cover_url || null,
        category: form.category,
        status: form.status,
        published_at:
          form.status === "published" ? new Date().toISOString() : null,
      };
      if (form.id) {
        const { error } = await supabase.from("berita").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("berita")
          .insert({ ...payload, author_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Berita disimpan");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-berita"] });
      qc.invalidateQueries({ queryKey: ["public-berita"] });
    },
    onError: (e: any) => toast.error(e.message || "Gagal menyimpan"),
  });

  const toggleStatus = useMutation({
    mutationFn: async (b: Berita) => {
      const next = b.status === "published" ? "draft" : "published";
      const { error } = await supabase
        .from("berita")
        .update({
          status: next,
          published_at: next === "published" ? new Date().toISOString() : null,
        })
        .eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-berita"] });
      qc.invalidateQueries({ queryKey: ["public-berita"] });
    },
    onError: (e: any) => toast.error(e.message || "Gagal"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("berita").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Berita dihapus");
      qc.invalidateQueries({ queryKey: ["admin-berita"] });
      qc.invalidateQueries({ queryKey: ["public-berita"] });
    },
    onError: (e: any) => toast.error(e.message || "Gagal menghapus"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Newspaper className="h-5 w-5 text-primary" /> Berita & Kegiatan
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola berita yang tampil di halaman publik koperasi.
          </p>
        </div>
        <Button onClick={openNew} className="rounded-full">
          <Plus className="h-4 w-4" /> Tambah Berita
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Berita</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Belum ada berita"
              desc="Buat berita pertama untuk koperasi Anda."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((b) => (
                <li key={b.id} className="flex items-center gap-4 py-3">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {b.cover_url ? (
                      <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Newspaper className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{b.title}</p>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {b.category}
                      </Badge>
                      <Badge
                        variant={b.status === "published" ? "default" : "outline"}
                        className="text-[10px] uppercase"
                      >
                        {b.status === "published" ? "Tayang" : "Draf"}
                      </Badge>
                    </div>
                    {b.excerpt && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{b.excerpt}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={b.status === "published" ? "Jadikan draf" : "Tayangkan"}
                      onClick={() => toggleStatus.mutate(b)}
                    >
                      {b.status === "published" ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      title="Hapus"
                      onClick={() => {
                        if (confirm(`Hapus berita "${b.title}"?`)) remove.mutate(b.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Berita" : "Tambah Berita"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Judul</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Judul berita / kegiatan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug URL</Label>
              <Input
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
                placeholder="otomatis-dari-judul"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draf</SelectItem>
                    <SelectItem value="published">Tayangkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Gambar Sampul</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-24 overflow-hidden rounded-lg border bg-muted">
                  {form.cover_url ? (
                    <img src={form.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageUp className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCover(f);
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-muted">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageUp className="h-4 w-4" />
                    )}
                    {uploading ? "Mengunggah…" : "Unggah Gambar"}
                  </span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ringkasan</Label>
              <Textarea
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="Ringkasan singkat (opsional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Isi Berita</Label>
              <Textarea
                rows={8}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Tulis isi berita / kegiatan…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || uploading}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}