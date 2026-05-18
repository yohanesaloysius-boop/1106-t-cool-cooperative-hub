import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Printer, BadgeCheck, Loader2 } from "lucide-react";
import { buildMemberCardPdf } from "@/lib/passbook-pdf";
import { toast } from "sonner";

export interface MemberCardProps {
  nama: string;
  nomor: string | null;
  status: string;
  joined_at: string | null;
  foto_url: string | null;
  koperasi?: string;
}

const dfmt = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export function MemberCard(p: MemberCardProps) {
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const koperasi = p.koperasi ?? "T-COOL Koperasi";

  useEffect(() => {
    QRCode.toDataURL(
      JSON.stringify({ type: "member", nomor: p.nomor, nama: p.nama }),
      { margin: 0, width: 200 },
    ).then(setQr).catch(() => setQr(""));
  }, [p.nomor, p.nama]);

  const initials = p.nama.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const handleDownload = async () => {
    try {
      setBusy(true);
      const doc = await buildMemberCardPdf({ ...p, koperasi });
      doc.save(`kartu-anggota-${p.nomor ?? "anggota"}.pdf`);
    } catch (e: any) {
      toast.error("Gagal membuat PDF kartu", { description: e.message });
    } finally { setBusy(false); }
  };

  const handlePrint = async () => {
    try {
      setBusy(true);
      const doc = await buildMemberCardPdf({ ...p, koperasi });
      const blobUrl = doc.output("bloburl");
      const w = window.open(blobUrl as string, "_blank");
      if (w) setTimeout(() => w.print(), 500);
    } catch (e: any) {
      toast.error("Gagal mencetak kartu", { description: e.message });
    } finally { setBusy(false); }
  };

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
    pending: "bg-amber-500/15 text-amber-700 border-amber-300",
    suspended: "bg-muted text-muted-foreground border-border",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <div className="space-y-3">
      <Card
        className="relative overflow-hidden p-5 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, oklch(0.35 0.13 250), oklch(0.55 0.15 280))" }}
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">{koperasi}</p>
            <p className="text-xs font-medium text-white/80">Kartu Anggota Digital</p>
          </div>
          <BadgeCheck className="h-6 w-6 text-white/80" />
        </div>

        <div className="relative mt-4 flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-white/30">
            {p.foto_url && <AvatarImage src={p.foto_url} alt={p.nama} />}
            <AvatarFallback className="bg-white/20 text-white">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-lg font-bold">{p.nama}</p>
            <p className="font-mono text-sm text-white/90">{p.nomor ?? "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`border-white/30 bg-white/10 text-[10px] text-white`}>
                {p.status.toUpperCase()}
              </Badge>
              <span className="text-[10px] text-white/70">
                Bergabung {p.joined_at ? dfmt(p.joined_at) : "—"}
              </span>
            </div>
          </div>
          {qr && (
            <div className="rounded-md bg-white p-1.5">
              <img src={qr} alt="QR Anggota" className="h-16 w-16" />
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
          Download PDF Kartu
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={busy}>
          <Printer className="h-3.5 w-3.5 mr-1" /> Cetak Kartu
        </Button>
        <Badge variant="outline" className={statusColor[p.status] ?? ""}>
          Status: {p.status}
        </Badge>
      </div>
    </div>
  );
}