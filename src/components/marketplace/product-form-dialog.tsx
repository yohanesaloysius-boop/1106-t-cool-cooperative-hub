import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  updateProduct,
  uploadMarketplaceFile,
  type DbCategory,
  type DbProduct,
  type ProductStatus,
} from "@/lib/marketplace-api";
import { RequiredMark } from "@/components/ui/required-mark";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  userId: string;
  categories: DbCategory[];
  product?: DbProduct | null;
  onSaved: () => void;
}

export function ProductFormDialog({ open, onOpenChange, storeId, userId, categories, product, onSaved }: Props) {
  const editing = !!product;
  const [nama, setNama] = useState("");
  const [harga, setHarga] = useState("0");
  const [stok, setStok] = useState("0");
  const [deskripsi, setDeskripsi] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<ProductStatus>("active");
  const [images, setImages] = useState<string[]>([]);
  const [diskon, setDiskon] = useState("0");
  const [isFeatured, setIsFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNama(product?.nama_produk ?? "");
      setHarga(String(product?.harga ?? 0));
      setStok(String(product?.stok ?? 0));
      setDeskripsi(product?.deskripsi ?? "");
      setCategoryId(product?.category_id ?? "");
      setStatus(product?.status_produk ?? "active");
      setImages(product?.gambar_produk ?? []);
      setDiskon(String(product?.diskon_persen ?? 0));
      setIsFeatured(!!product?.is_featured);
    }
  }, [open, product]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 6 - images.length)) {
        const url = await uploadMarketplaceFile(userId, f, "produk");
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      toast.error(e.message || "Gagal upload foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!nama.trim()) return toast.error("Nama produk wajib diisi");
    const hargaNum = Number(harga);
    const stokNum = Number(stok);
    if (!Number.isFinite(hargaNum) || hargaNum < 0) return toast.error("Harga tidak valid");
    if (!Number.isFinite(stokNum) || stokNum < 0) return toast.error("Stok tidak valid");

    const diskonNum = Math.min(90, Math.max(0, Number(diskon) || 0));
    setSaving(true);
    try {
      if (editing && product) {
        await updateProduct(product.id, {
          nama_produk: nama.trim(),
          harga: hargaNum,
          stok: stokNum,
          deskripsi: deskripsi.trim() || null,
          category_id: categoryId || null,
          gambar_produk: images,
          status_produk: status,
          diskon_persen: diskonNum,
          is_featured: isFeatured,
        } as any);
        toast.success("Produk diperbarui");
      } else {
        await createProduct({
          store_id: storeId,
          nama_produk: nama.trim(),
          harga: hargaNum,
          stok: stokNum,
          deskripsi: deskripsi.trim() || undefined,
          category_id: categoryId || null,
          gambar_produk: images,
          status_produk: status,
          diskon_persen: diskonNum,
          is_featured: isFeatured,
        } as any);
        toast.success("Produk ditambahkan");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Foto produk */}
          <div>
            <Label>Foto Produk (maks 6)<RequiredMark /></Label>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {images.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span>Upload</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>

          <div>
            <Label>Nama Produk<RequiredMark /></Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} placeholder="Mis. Nasi Box Ayam Bakar" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Harga (Rp)<RequiredMark /></Label>
              <Input type="number" min={0} value={harga} onChange={(e) => setHarga(e.target.value)} />
            </div>
            <div>
              <Label>Stok<RequiredMark /></Label>
              <Input type="number" min={0} value={stok} onChange={(e) => setStok(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Kategori<RequiredMark /></Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nama_kategori}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status<RequiredMark /></Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif (Tampil)</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="out_of_stock">Stok Habis</SelectItem>
                  <SelectItem value="archived">Arsip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Deskripsi<RequiredMark /></Label>
            <Textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Ceritakan keunggulan produk, bahan, ukuran, dll."
            />
          </div>

          <div className="grid gap-4 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
            <div>
              <Label>Diskon (%)</Label>
              <Input type="number" min={0} max={90} value={diskon} onChange={(e) => setDiskon(e.target.value)} placeholder="0" />
              <p className="mt-1 text-[11px] text-muted-foreground">Maks 90%. Isi 0 jika tidak ada diskon.</p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background/60 p-3">
              <div>
                <Label className="text-sm">Produk Unggulan</Label>
                <p className="text-[11px] text-muted-foreground">Tampil di banner promo toko</p>
              </div>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Simpan Perubahan" : "Tambah Produk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
