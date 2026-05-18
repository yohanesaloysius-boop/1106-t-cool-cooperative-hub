import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

export interface UploadResult {
  path: string;
  publicUrl?: string;
}

interface Props {
  bucket: "ktp" | "avatars" | "bukti-transfer" | "dokumen-pinjaman" | "tanda-tangan" | "laporan-pdf" | "verifikasi-pinjaman";
  userId: string;
  accept?: string;
  label: string;
  hint?: string;
  maxMB?: number;
  onUploaded: (res: UploadResult) => void;
  publicBucket?: boolean;
}

export function FileUpload({ bucket, userId, accept = "image/*", label, hint, maxMB = 4, onUploaded, publicBucket = false }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${maxMB}MB`);
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const publicUrl = publicBucket ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : undefined;
      setDone(file.name);
      onUploaded({ path, publicUrl });
      toast.success("Berhasil diunggah");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {done && (
          <button type="button" onClick={() => { setDone(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-2">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Upload className="h-3.5 w-3.5" />}
          {done ? "Ganti file" : "Pilih file"}
        </Button>
        {done && <span className="truncate text-xs text-muted-foreground">{done}</span>}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
