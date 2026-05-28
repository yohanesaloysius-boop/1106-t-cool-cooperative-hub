import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Instagram, Facebook, Music2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  createMyStore,
  updateStore,
  uploadMarketplaceFile,
  type DbStore,
} from "@/lib/marketplace-api";
import { RequiredMark } from "@/components/ui/required-mark";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  store?: DbStore | null;
  onSaved: (store: DbStore) => void;
}

export function StoreFormDialog({ open, onOpenChange, userId, store, onSaved }: Props) {
  const editing = !!store;
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [shopee, setShopee] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNama(store?.nama_toko ?? "");
      setDeskripsi(store?.deskripsi ?? "");
      setWhatsapp(store?.whatsapp ?? "");
      setAlamat(store?.alamat ?? "");
      setLogo(store?.logo ?? null);
      setBanner(store?.banner ?? null);
      setInstagram(store?.instagram ?? "");
      setFacebook(store?.facebook ?? "");
      setTiktok(store?.tiktok ?? "");
      setShopee(store?.shopee ?? "");
    }
  }, [open, store]);

  async function pickFile(file: File | undefined, kind: "logo" | "banner") {
    if (!file) return;
    const setLoading = kind === "logo" ? setUploadingLogo : setUploadingBanner;
    setLoading(true);
    try {
      const url = await uploadMarketplaceFile(userId, file, kind);
      if (kind === "logo") setLogo(url);
      else setBanner(url);
    } catch (e: any) {
      toast.error(e.message || "Gagal upload");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!nama.trim()) return toast.error("Nama toko wajib diisi");
    setSaving(true);
    try {
      let saved: DbStore;
      if (editing && store) {
        saved = await updateStore(store.id, {
          nama_toko: nama.trim(),
          deskripsi: deskripsi.trim() || null,
          whatsapp: whatsapp.trim() || null,
          alamat: alamat.trim() || null,
          logo,
          banner,
          instagram: instagram.trim() || null,
          facebook: facebook.trim() || null,
          tiktok: tiktok.trim() || null,
          shopee: shopee.trim() || null,
        });
        toast.success("Profil toko diperbarui");
      } else {
        saved = await createMyStore({
          member_id: userId,
          nama_toko: nama.trim(),
          deskripsi: deskripsi.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          alamat: alamat.trim() || undefined,
          logo: logo ?? undefined,
          banner: banner ?? undefined,
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          shopee: shopee.trim() || undefined,
        });
        toast.success("Toko berhasil dibuka 🎉");
      }
      onSaved(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan toko");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Profil Toko" : "Buka Toko Baru"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Banner */}
          <div>
            <Label>Banner Toko</Label>
            <div
              onClick={() => bannerRef.current?.click()}
              className="relative mt-2 flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted"
            >
              {banner ? (
                <img src={banner} alt="" className="h-full w-full object-cover" />
              ) : uploadingBanner ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex flex-col items-center text-xs text-muted-foreground">
                  <ImagePlus className="mb-1 h-6 w-6" />
                  Klik untuk upload banner (1200x400)
                </div>
              )}
            </div>
            <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0], "banner")} />
          </div>

          {/* Logo */}
          <div className="flex items-end gap-4">
            <div>
              <Label>Logo Toko</Label>
              <div
                onClick={() => logoRef.current?.click()}
                className="mt-2 flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted"
              >
                {logo ? (
                  <img src={logo} alt="" className="h-full w-full object-cover" />
                ) : uploadingLogo ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0], "logo")} />
            </div>
            <p className="pb-1 text-xs text-muted-foreground">Gambar persegi, min. 200x200. Format JPG/PNG.</p>
          </div>

          <div>
            <Label>Nama Usaha</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={80} placeholder="Mis. Dapur Bu Sari" />
          </div>

          <div>
            <Label>Deskripsi Usaha</Label>
            <Textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={3} maxLength={500} placeholder="Ceritakan tentang usaha kamu..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="628123456789" maxLength={20} />
            </div>
            <div>
              <Label>Alamat</Label>
              <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} maxLength={200} placeholder="Kota / Kecamatan" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <Label className="text-sm font-semibold">Sosial Media (opsional)</Label>
            <p className="mb-3 text-xs text-muted-foreground">Username tanpa @, atau link lengkap</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 shrink-0 text-pink-500" />
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram" maxLength={80} />
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 shrink-0 text-blue-600" />
                <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook" maxLength={80} />
              </div>
              <div className="flex items-center gap-2">
                <Music2 className="h-4 w-4 shrink-0" />
                <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="tiktok" maxLength={80} />
              </div>
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 shrink-0 text-orange-500" />
                <Input value={shopee} onChange={(e) => setShopee(e.target.value)} placeholder="shopee" maxLength={80} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || uploadingLogo || uploadingBanner}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Simpan" : "Buka Toko"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
