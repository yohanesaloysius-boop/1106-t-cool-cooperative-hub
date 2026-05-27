import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sekolah/pengadaan")({
  head: () => ({ meta: [{ title: "Belanja Sekolah — T-COOL" }] }),
  component: BelanjaSekolahPage,
});

function BelanjaSekolahPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Belanja Sekolah</h1>
        <p className="text-sm text-muted-foreground">Pengadaan barang/jasa untuk sekolah / yayasan pendidikan.</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Segera Hadir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary mb-1">
              <Sparkles className="h-4 w-4" /> Alur sama seperti Belanja Gereja
            </p>
            <p className="text-muted-foreground">
              Modul ini akan mengikuti alur Pengadaan Gereja: pengajuan PR oleh PIC sekolah →
              approval keuangan → approval ketua → diteruskan ke koperasi → pemilihan vendor →
              terbit PO → pembayaran vendor → fee jasa koperasi 2% → barang diterima → selesai.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Database paralel (sekolah_purchase_requests, divisi sekolah, requester sekolah) akan diaktifkan pada iterasi berikutnya.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
