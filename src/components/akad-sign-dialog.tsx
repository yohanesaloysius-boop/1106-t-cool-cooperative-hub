import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { akadPdfBlob, type AkadData } from "@/lib/akad-pdf";
import { FileSignature, Download, Loader2 } from "lucide-react";

interface Props {
  pinjaman: any;
  profile: { nama: string; nomor: string | null; nik: string | null; alamat: string | null };
  trigger?: React.ReactNode;
  role: "member" | "pengurus";
  jabatan?: string;
}

export function AkadSignDialog({ pinjaman, profile, trigger, role, jabatan = "Pengurus" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const ensureAkad = async () => {
    const { data: existing } = await (supabase.from("loan_agreements" as any)
      .select("*")
      .eq("pinjaman_id", pinjaman.id)
      .maybeSingle());
    if (existing) return existing as any;
    const { data, error } = await (supabase.from("loan_agreements" as any).insert({
      pinjaman_id: pinjaman.id,
      user_id: pinjaman.user_id,
      status: "pending_member",
      snapshot: {
        nominal: pinjaman.nominal,
        tenor_bulan: pinjaman.tenor_bulan,
        bunga_persen: pinjaman.bunga_persen,
        bunga_jenis: pinjaman.bunga_jenis,
        cicilan_per_bulan: pinjaman.cicilan_per_bulan,
        total_bayar: pinjaman.total_bayar,
        tujuan: pinjaman.tujuan,
      },
    }).select("*").single());
    if (error) throw error;
    return data as any;
  };

  const buildAndUpload = async (akad: any, opts: { memberSig?: SignatureResult; pengurusSig?: SignatureResult }) => {
    const data: AkadData = {
      nomorAkad: `AKD/${String(pinjaman.id).slice(0, 8).toUpperCase()}/${new Date().getFullYear()}`,
      tanggal: new Date().toISOString(),
      anggota: profile,
      pinjaman: {
        nominal: Number(pinjaman.nominal),
        tenor_bulan: Number(pinjaman.tenor_bulan),
        bunga_persen: Number(pinjaman.bunga_persen),
        bunga_jenis: String(pinjaman.bunga_jenis),
        cicilan_per_bulan: Number(pinjaman.cicilan_per_bulan ?? 0),
        total_bayar: Number(pinjaman.total_bayar ?? 0),
        tujuan: pinjaman.tujuan,
      },
      koperasi: { nama: "T-COOL Koperasi", alamat: "Indonesia" },
      memberSignature: opts.memberSig
        ? { dataUrl: opts.memberSig.dataUrl, name: opts.memberSig.fullName, signedAt: akad.member_signed_at ?? new Date().toISOString() }
        : (akad.member_signature_url
          ? { dataUrl: akad.member_signature_url, name: profile.nama, signedAt: akad.member_signed_at }
          : undefined),
      pengurusSignature: opts.pengurusSig
        ? { dataUrl: opts.pengurusSig.dataUrl, name: opts.pengurusSig.fullName, jabatan, signedAt: new Date().toISOString() }
        : undefined,
    };
    const blob = await akadPdfBlob(data);
    const path = `${pinjaman.user_id}/${pinjaman.id}-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage.from("akad-pinjaman").upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;
    return path;
  };

  const recordSignature = async (sig: SignatureResult, refId: string) => {
    const { data, error } = await supabase.from("signatures").insert({
      user_id: user!.id,
      signature_url: sig.dataUrl,
      hash: sig.hash,
      ref_table: "loan_agreements",
      ref_id: refId,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
    }).select("id").single();
    if (error) throw error;
    return data.id as string;
  };

  const sign = useMutation({
    mutationFn: async (sig: SignatureResult) => {
      const akad = await ensureAkad();
      const sigId = await recordSignature(sig, akad.id);

      const updates: any = {};
      if (role === "member") {
        updates.member_signature_id = sigId;
        updates.member_signed_at = new Date().toISOString();
        updates.status = "pending_pengurus";
        const path = await buildAndUpload(akad, { memberSig: sig });
        updates.pdf_path = path;
      } else {
        updates.pengurus_signature_id = sigId;
        updates.pengurus_signed_at = new Date().toISOString();
        updates.pengurus_id = user!.id;
        updates.status = "signed";
        // need member signature from previous record — refetch
        const { data: memberSig } = akad.member_signature_id
          ? await supabase.from("signatures").select("signature_url").eq("id", akad.member_signature_id).single()
          : { data: null };
        const memberSigResult: SignatureResult | undefined = memberSig
          ? { dataUrl: (memberSig as any).signature_url, fullName: profile.nama, hash: "" }
          : undefined;
        const path = await buildAndUpload(akad, { memberSig: memberSigResult, pengurusSig: sig });
        updates.pdf_path = path;
      }
      const { error } = await (supabase.from("loan_agreements" as any).update(updates).eq("id", akad.id));
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: role === "member" ? pinjaman.user_id : pinjaman.user_id,
        judul: role === "member" ? "Akad Ditandatangani" : "Akad Pinjaman Selesai",
        pesan: role === "member"
          ? "Akad telah Anda tandatangani. Menunggu tanda tangan pengurus."
          : "Akad pinjaman telah ditandatangani lengkap. Dana siap dicairkan.",
        kategori: "sukses",
      });
    },
    onSuccess: () => {
      toast.success("Akad berhasil ditandatangani");
      qc.invalidateQueries({ queryKey: ["pinjaman"] });
      qc.invalidateQueries({ queryKey: ["admin-pinjaman"] });
      qc.invalidateQueries({ queryKey: ["akad", pinjaman.id] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="outline" className="gap-1"><FileSignature className="h-3 w-3" /> Tanda Tangani Akad</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Akad Perjanjian Pinjaman</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Dengan menandatangani, Anda menyetujui ketentuan pinjaman dan denda keterlambatan sesuai kebijakan koperasi.
            Tanda tangan digital memiliki kekuatan hukum sesuai UU ITE.
          </p>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <p><strong>Pokok:</strong> Rp {Number(pinjaman.nominal).toLocaleString("id-ID")}</p>
            <p><strong>Tenor:</strong> {pinjaman.tenor_bulan} bulan</p>
            <p><strong>Cicilan/bln:</strong> Rp {Number(pinjaman.cicilan_per_bulan ?? 0).toLocaleString("id-ID")}</p>
          </div>
        </div>
        <DialogFooter>
          <SignaturePadDialog
            title={role === "member" ? "Tanda Tangan Anggota" : `Tanda Tangan ${jabatan}`}
            onSign={(sig) => sign.mutateAsync(sig)}
            trigger={
              <Button disabled={sign.isPending} className="gap-1">
                {sign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
                Tanda Tangani
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AkadDownloadButton({ pdfPath }: { pdfPath: string }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from("akad-pinjaman").createSignedUrl(pdfPath, 600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Akad PDF
    </Button>
  );
}
