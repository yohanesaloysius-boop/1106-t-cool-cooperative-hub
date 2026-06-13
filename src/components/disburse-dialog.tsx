import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SignaturePadDialog, type SignatureResult } from "@/components/signature-pad";
import { Banknote } from "lucide-react";

export interface DisburseInfo {
  bank: string;
  rekeningNomor: string;
  rekeningNama: string;
}

export function DisburseDialog({
  onDisburse,
  defaultNama = "",
}: {
  onDisburse: (info: DisburseInfo, sig: SignatureResult) => void | Promise<void>;
  defaultNama?: string;
}) {
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState("");
  const [rekeningNomor, setRekeningNomor] = useState("");
  const [rekeningNama, setRekeningNama] = useState(defaultNama);

  const valid = bank.trim() && rekeningNomor.trim() && rekeningNama.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-xs">
          <Banknote className="h-3 w-3" /> Cairkan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Pencairan Pinjaman</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Masukkan rekening tujuan pengiriman dana sebelum menandatangani pencairan.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="cair-bank">Nama Bank</Label>
            <Input id="cair-bank" placeholder="contoh: BCA, Mandiri, BRI" value={bank} onChange={(e) => setBank(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cair-norek">Nomor Rekening</Label>
            <Input id="cair-norek" inputMode="numeric" placeholder="contoh: 1234567890" value={rekeningNomor} onChange={(e) => setRekeningNomor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cair-nama">Nama Pemilik Rekening</Label>
            <Input id="cair-nama" placeholder="nama sesuai buku tabungan" value={rekeningNama} onChange={(e) => setRekeningNama(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <SignaturePadDialog
            title="Tanda Tangan Pencairan"
            onSign={async (sig) => {
              await onDisburse({ bank: bank.trim(), rekeningNomor: rekeningNomor.trim(), rekeningNama: rekeningNama.trim() }, sig);
              setOpen(false);
            }}
            trigger={<Button disabled={!valid} className="gap-1"><Banknote className="h-4 w-4" /> Tanda Tangani & Cairkan</Button>}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}