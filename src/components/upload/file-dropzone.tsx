import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { uploadFile, type UploadResult } from "@/lib/upload";
import { UPLOAD_RULES, validateFile, type UploadKind } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  kind: UploadKind;
  folder?: string;
  onUploaded: (result: UploadResult) => void;
  className?: string;
  label?: string;
  defaultPreviewUrl?: string | null;
};

export function FileDropzone({
  kind,
  folder,
  onUploaded,
  className,
  label,
  defaultPreviewUrl,
}: Props) {
  const { user } = useAuth();
  const rule = UPLOAD_RULES[kind];
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(defaultPreviewUrl || null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; mime: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || !files.length) return;
      const file = files[0];
      const err = validateFile(file, kind);
      if (err) return toast.error(err);
      if (!user) return toast.error("Login dulu");

      setBusy(true);
      const localPreview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setPreview(localPreview);
      setFileMeta({ name: file.name, size: file.size, mime: file.type });

      const res = await uploadFile(file, kind, { userId: user.id, folder });
      setBusy(false);
      if (res) {
        onUploaded(res);
        toast.success("File berhasil diupload");
        if (res.signedUrl && file.type.startsWith("image/")) setPreview(res.signedUrl);
      } else {
        setPreview(null);
        setFileMeta(null);
      }
    },
    [kind, folder, user, onUploaded]
  );

  const accept = rule.mimes.join(",");

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          busy && "opacity-60 pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {busy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Mengupload...</span>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-2">
            {preview.startsWith("blob:") || preview.includes("image") || fileMeta?.mime.startsWith("image/") ? (
              <img src={preview} alt="preview" className="max-h-40 rounded" />
            ) : (
              <FileText className="h-10 w-10 text-primary" />
            )}
            {fileMeta && (
              <div className="text-xs text-muted-foreground">
                {fileMeta.name} • {(fileMeta.size / 1024).toFixed(0)} KB
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
                setFileMeta(null);
              }}
            >
              <X className="h-3 w-3 mr-1" /> Ganti
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {rule.mimes.some((m) => m.startsWith("image/")) ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="text-sm font-medium">{label || `Upload ${rule.label}`}</div>
            <div className="text-xs text-muted-foreground">
              Drag & drop atau klik. Max {rule.maxMB} MB •{" "}
              {rule.mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}