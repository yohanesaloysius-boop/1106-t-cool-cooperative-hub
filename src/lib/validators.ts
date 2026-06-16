import { z } from "zod";

// ---------- Common ----------
export const NIK = z
  .string()
  .trim()
  .regex(/^\d{16}$/, "NIK harus 16 digit angka");

export const NoHP = z
  .string()
  .trim()
  .regex(/^(\+62|62|0)8\d{8,12}$/, "Nomor HP tidak valid");

export const Email = z.string().trim().email("Email tidak valid").max(255);

export const NominalRupiah = z
  .number({ invalid_type_error: "Harus berupa angka" })
  .int("Tidak boleh ada desimal")
  .min(1000, "Minimal Rp 1.000")
  .max(1_000_000_000, "Maksimal Rp 1 miliar");

// ---------- Anggota ----------
export const AnggotaSchema = z.object({
  nama_lengkap: z.string().trim().min(3, "Min 3 karakter").max(100),
  email: Email,
  no_hp: NoHP,
  nik: NIK,
  alamat: z.string().trim().min(5).max(500),
  tempat_lahir: z.string().trim().max(100).optional(),
  tanggal_lahir: z.string().optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
  pekerjaan: z.string().trim().max(100).optional(),
});
export type AnggotaInput = z.infer<typeof AnggotaSchema>;

// ---------- Pinjaman ----------
export const PinjamanSchema = z.object({
  nominal: NominalRupiah,
  tenor_bulan: z.number().int().min(1).max(60),
  bunga_persen: z.number().min(0).max(20).default(1.5),
  bunga_jenis: z.enum(["flat", "menurun"]).default("flat"),
  tujuan: z.string().trim().min(5, "Min 5 karakter").max(500),
});
export type PinjamanInput = z.infer<typeof PinjamanSchema>;

// ---------- Simpanan ----------
export const SimpananSchema = z.object({
  jenis: z.enum(["pokok", "wajib", "sukarela"]),
  nominal: NominalRupiah,
  catatan: z.string().trim().max(500).optional(),
});
export type SimpananInput = z.infer<typeof SimpananSchema>;

// ---------- Angsuran ----------
export const AngsuranSchema = z.object({
  pinjaman_id: z.string().uuid(),
  cicilan_ke: z.number().int().min(1),
  nominal: NominalRupiah,
  jatuh_tempo: z.string(),
});
export type AngsuranInput = z.infer<typeof AngsuranSchema>;

// ---------- File / Upload ----------
export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_DOC = ["application/pdf", ...ALLOWED_IMAGE] as const;

export type UploadKind = "ktp" | "dokumen-pinjaman" | "bukti-transfer" | "tanda-tangan" | "laporan-pdf" | "berita";

export const UPLOAD_RULES: Record<
  UploadKind,
  { mimes: readonly string[]; maxMB: number; bucket: string; label: string }
> = {
  ktp: { mimes: ALLOWED_IMAGE, maxMB: 5, bucket: "ktp", label: "Foto KTP" },
  "dokumen-pinjaman": { mimes: ALLOWED_DOC, maxMB: 10, bucket: "dokumen-pinjaman", label: "Dokumen Pinjaman" },
  "bukti-transfer": { mimes: ALLOWED_IMAGE, maxMB: 5, bucket: "bukti-transfer", label: "Bukti Transfer" },
  "tanda-tangan": { mimes: ["image/png"], maxMB: 1, bucket: "tanda-tangan", label: "Tanda Tangan" },
  "laporan-pdf": { mimes: ["application/pdf"], maxMB: 20, bucket: "laporan-pdf", label: "Laporan PDF" },
  berita: { mimes: ALLOWED_IMAGE, maxMB: 5, bucket: "marketplace", label: "Gambar Berita" },
};

export function validateFile(file: File, kind: UploadKind): string | null {
  const r = UPLOAD_RULES[kind];
  if (!r.mimes.includes(file.type)) {
    return `Format harus ${r.mimes.map((m) => m.split("/")[1].toUpperCase()).join("/")}`;
  }
  if (file.size > r.maxMB * 1024 * 1024) {
    return `Ukuran maksimal ${r.maxMB} MB`;
  }
  if (file.size === 0) return "File kosong";
  return null;
}