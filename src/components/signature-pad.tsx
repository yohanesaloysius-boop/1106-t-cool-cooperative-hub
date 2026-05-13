import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eraser, PenLine } from "lucide-react";

export interface SignatureResult {
  dataUrl: string;
  hash: string;
  fullName: string;
}

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function SignaturePadDialog({
  trigger,
  title = "Tanda Tangan Digital",
  onSign,
}: {
  trigger: React.ReactNode;
  title?: string;
  onSign: (sig: SignatureResult) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  const start = (x: number, y: number) => {
    drawing.current = true;
    const c = ctx();
    if (!c) return;
    c.lineWidth = 2;
    c.lineCap = "round";
    c.strokeStyle = "#0f172a";
    c.beginPath();
    c.moveTo(x, y);
  };
  const move = (x: number, y: number) => {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    c.lineTo(x, y);
    c.stroke();
    dirty.current = true;
  };
  const end = () => { drawing.current = false; };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const clear = () => {
    const c = ctx();
    const cv = canvasRef.current;
    if (!c || !cv) return;
    c.clearRect(0, 0, cv.width, cv.height);
    dirty.current = false;
  };

  const submit = async () => {
    if (!name.trim()) return;
    if (!dirty.current) return;
    setBusy(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL("image/png");
      const hash = await sha256(`${name}|${dataUrl}|${Date.now()}`);
      await onSign({ dataUrl, hash, fullName: name.trim() });
      setOpen(false);
      setName("");
      clear();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-4 w-4" /> {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="signer">Nama Lengkap Penandatangan</Label>
            <Input id="signer" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama sesuai KTP" />
          </div>
          <div className="space-y-2">
            <Label>Tanda Tangan</Label>
            <div className="rounded-lg border border-border bg-card">
              <canvas
                ref={canvasRef}
                width={420}
                height={160}
                className="h-40 w-full touch-none rounded-lg"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const [x,y]=pos(e); start(x,y); }}
                onPointerMove={(e) => { const [x,y]=pos(e); move(x,y); }}
                onPointerUp={end}
                onPointerLeave={end}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clear} className="text-xs">
              <Eraser className="mr-1 h-3 w-3" /> Bersihkan
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dengan menandatangani, Anda menyetujui tindakan ini secara sah dan akan tercatat dalam audit log.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Memproses..." : "Tanda Tangani"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
