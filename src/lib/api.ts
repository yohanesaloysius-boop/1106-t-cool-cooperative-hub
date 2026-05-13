import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

/** Standardized API error with stable shape across the app. */
export type ApiError = {
  code: string;
  message: string;
  details?: string;
  hint?: string;
};

const HUMAN_MESSAGES: Record<string, string> = {
  "23505": "Data sudah ada (duplikat).",
  "23503": "Data terkait tidak ditemukan.",
  "23502": "Ada field wajib yang kosong.",
  "42501": "Anda tidak memiliki izin untuk aksi ini.",
  PGRST301: "Sesi Anda berakhir, silakan login ulang.",
  PGRST116: "Data tidak ditemukan.",
};

export function toApiError(err: unknown): ApiError {
  if (!err) return { code: "unknown", message: "Terjadi kesalahan tidak diketahui" };
  const e = err as Partial<PostgrestError> & { message?: string; status?: number };
  const code = e.code || (e.status ? String(e.status) : "unknown");
  const message = HUMAN_MESSAGES[code] || e.message || "Terjadi kesalahan";
  return { code, message, details: e.details, hint: e.hint };
}

/** Wrap a Supabase query/mutation, surfacing a consistent error + toast. */
export async function apiCall<T>(
  fn: () => Promise<{ data: T | null; error: unknown }>,
  opts: { successMessage?: string; errorMessage?: string; silent?: boolean } = {}
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const { data, error } = await fn();
    if (error) {
      const apiErr = toApiError(error);
      if (!opts.silent) toast.error(opts.errorMessage || apiErr.message);
      return { data: null, error: apiErr };
    }
    if (opts.successMessage && !opts.silent) toast.success(opts.successMessage);
    return { data, error: null };
  } catch (err) {
    const apiErr = toApiError(err);
    if (!opts.silent) toast.error(opts.errorMessage || apiErr.message);
    return { data: null, error: apiErr };
  }
}