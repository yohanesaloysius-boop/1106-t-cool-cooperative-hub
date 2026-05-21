import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, RotateCcw, Check, Upload, ImageIcon, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  facingMode?: "user" | "environment";
  title: string;
  hint?: string;
  guide?: "ktp" | "face";
  bucket: "verifikasi-pinjaman";
  userId: string;
  /** Teks watermark (mis. nama anggota) ditanam ke foto untuk anti-reuse. */
  watermark?: string;
  onUploaded: (path: string, dataUrl: string) => void;
}

/** Estimasi blur dengan variance pixel luminance (cepat, klien). */
function estimateBlur(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { variance: 0, brightness: 0 };
  const w = Math.min(canvas.width, 240);
  const h = Math.round((w / canvas.width) * canvas.height);
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  tmp.getContext("2d")!.drawImage(canvas, 0, 0, w, h);
  const img = tmp.getContext("2d")!.getImageData(0, 0, w, h).data;
  let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < img.length; i += 16) {
    const l = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    sum += l; sum2 += l * l; n++;
  }
  const mean = sum / n;
  return { variance: sum2 / n - mean * mean, brightness: mean };
}

export function CameraCapture({ open, onOpenChange, facingMode = "environment", title, hint, guide = "ktp", bucket, userId, onUploaded }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [quality, setQuality] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) { stop(); setSnapshot(null); setQuality(null); setError(null); return; }
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (e) {
        setError("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan, atau gunakan unggah dari galeri.");
      }
    })();
    return stop;
  }, [open, facingMode, stop]);

  const takePhoto = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const { variance, brightness } = estimateBlur(canvas);
    let ok = true; let reason: string | undefined;
    if (variance < 80) { ok = false; reason = "Gambar terlalu blur. Pegang HP lebih stabil."; }
    else if (brightness < 50) { ok = false; reason = "Terlalu gelap. Cari pencahayaan yang lebih baik."; }
    else if (brightness > 230) { ok = false; reason = "Terlalu terang/silau."; }
    setQuality({ ok, reason });
    setSnapshot(canvas.toDataURL("image/jpeg", 0.9));
  };

  const retake = () => { setSnapshot(null); setQuality(null); };

  const fromGallery = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const q = estimateBlur(canvas);
        setQuality({ ok: q.variance > 40, reason: q.variance > 40 ? undefined : "Gambar terlalu blur." });
        setSnapshot(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const upload = async () => {
    if (!snapshot) return;
    setBusy(true);
    try {
      const blob = await (await fetch(snapshot)).blob();
      const path = `${userId}/${guide}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: "image/jpeg", upsert: true,
      });
      if (error) throw error;
      onUploaded(path, snapshot);
      toast.success("Foto tersimpan");
      onOpenChange(false);
    } catch (e) {
      toast.error("Gagal upload", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 sm:rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black aspect-[4/3] sm:aspect-video">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
              <div>
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400" />
                {error}
              </div>
            </div>
          ) : snapshot ? (
            <img src={snapshot} alt="preview" className="h-full w-full object-contain" />
          ) : (
            <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`} />
          )}
          {/* Frame guide */}
          {!snapshot && !error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {guide === "ktp" ? (
                <div className="relative h-[55%] w-[80%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <span className="absolute -top-7 left-0 rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-black">Posisikan KTP di dalam bingkai</span>
                </div>
              ) : (
                <div className="relative h-[70%] aspect-[3/4] rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-black">Wajah di dalam lingkaran</span>
                </div>
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        {hint && <p className="px-4 pt-2 text-xs text-muted-foreground">{hint}</p>}
        {quality && (
          <div className={`mx-4 mt-2 rounded-lg border p-2 text-xs ${quality.ok ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
            {quality.ok ? "✓ Kualitas gambar bagus" : `⚠ ${quality.reason}`}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) fromGallery(f); }} />
          {!snapshot ? (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
                <ImageIcon className="h-4 w-4" /> Galeri
              </Button>
              <Button size="lg" onClick={takePhoto} disabled={!!error} className="gap-2">
                <Camera className="h-5 w-5" /> Ambil Foto
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Batal</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={retake} className="gap-1"><RotateCcw className="h-4 w-4" /> Ulangi</Button>
              <Button onClick={upload} disabled={busy || (quality ? !quality.ok : false)} className="gap-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Gunakan Foto
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
