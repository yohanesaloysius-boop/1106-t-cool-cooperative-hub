import { supabase } from "@/integrations/supabase/client";
import { UPLOAD_RULES, validateFile, type UploadKind } from "./validators";
import { toast } from "sonner";

/** Sanitize + auto-rename: <userId>/<folder?>/<timestamp>-<random>.<ext> */
export function buildObjectKey(
  userId: string,
  filename: string,
  folder?: string
): string {
  const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeFolder = folder
    ? folder.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "") + "/"
    : "";
  return `${userId}/${safeFolder}${ts}-${rand}.${ext}`;
}

export type UploadResult = {
  path: string;
  bucket: string;
  publicUrl: string | null;
  signedUrl: string | null;
  size: number;
  mime: string;
  name: string;
};

export async function uploadFile(
  file: File,
  kind: UploadKind,
  opts: { userId: string; folder?: string; silent?: boolean } = { userId: "" }
): Promise<UploadResult | null> {
  const err = validateFile(file, kind);
  if (err) {
    if (!opts.silent) toast.error(err);
    return null;
  }
  if (!opts.userId) {
    if (!opts.silent) toast.error("Anda harus login dulu");
    return null;
  }
  const rule = UPLOAD_RULES[kind];
  const key = buildObjectKey(opts.userId, file.name, opts.folder);

  const { error: upErr } = await supabase.storage
    .from(rule.bucket)
    .upload(key, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (upErr) {
    if (!opts.silent) toast.error(`Upload gagal: ${upErr.message}`);
    return null;
  }

  // public URL only valid for public buckets; signed URL for private
  const { data: signed } = await supabase.storage
    .from(rule.bucket)
    .createSignedUrl(key, 60 * 60);

  const { data: pub } = supabase.storage.from(rule.bucket).getPublicUrl(key);

  return {
    path: key,
    bucket: rule.bucket,
    publicUrl: pub?.publicUrl || null,
    signedUrl: signed?.signedUrl || null,
    size: file.size,
    mime: file.type,
    name: file.name,
  };
}

/** Get a fresh signed URL for a previously stored file (private buckets). */
export async function getSignedUrl(bucket: string, path: string, expiresInSec = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl || null;
}

/** Generic duplicate checker: returns true if a row exists with the given column == value. */
export async function checkDuplicate(
  table: string,
  column: string,
  value: string,
  excludeId?: string
): Promise<boolean> {
  let q: any = (supabase.from(table as any) as any)
    .select("id", { head: true, count: "exact" })
    .eq(column, value);
  if (excludeId) q = q.neq("id", excludeId);
  const { count, error } = await q;
  if (error) return false;
  return (count || 0) > 0;
}