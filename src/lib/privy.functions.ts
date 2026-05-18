import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Privy e-KYC verification.
 *
 * Production: panggil endpoint resmi Privy (PKS Dukcapil) menggunakan PRIVY_API_KEY.
 *   - POST {PRIVY_BASE_URL}/v1/identity/verify
 *   - body: { ktp_image_base64, selfie_image_base64, nik? }
 *   - response: { nik, nama, tgl_lahir, alamat, face_match_score, status }
 *
 * Fallback (mock): apabila PRIVY_API_KEY belum diisi, kembalikan hasil
 * simulasi deterministik berdasarkan path foto agar UI tetap dapat diuji.
 */
export const verifyWithPrivy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ktpPath: z.string().min(1).max(512),
      selfiePath: z.string().min(1).max(512),
      bucket: z.string().min(1).max(64).default("verifikasi-pinjaman"),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.PRIVY_API_KEY;
    const baseUrl = process.env.PRIVY_BASE_URL ?? "https://api.privy.id";
    const { supabase, userId } = context;

    // Ambil signed URL agar Privy bisa mengunduh (atau di-base64-kan).
    const [ktpSigned, selfieSigned] = await Promise.all([
      supabase.storage.from(data.bucket).createSignedUrl(data.ktpPath, 300),
      supabase.storage.from(data.bucket).createSignedUrl(data.selfiePath, 300),
    ]);
    if (ktpSigned.error || selfieSigned.error) {
      return { ok: false, provider: "privy", error: "Gagal membaca foto dari storage." } as const;
    }

    if (!apiKey) {
      // ─── MOCK MODE (no PRIVY_API_KEY) ───────────────────────────────
      const seed = (data.ktpPath + data.selfiePath).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const score = 0.82 + ((seed % 13) / 100); // 0.82–0.94
      return {
        ok: true,
        provider: "privy",
        mode: "mock" as const,
        userId,
        result: {
          nik: "32" + String(seed).padStart(14, "0").slice(-14),
          nama: "ANGGOTA KOPERASI",
          tempat_lahir: "JAKARTA",
          tgl_lahir: "1990-01-01",
          jenis_kelamin: "L",
          alamat: "JL. CONTOH NO. 1",
          face_match_score: Number(score.toFixed(3)),
          liveness: "passed" as const,
          status: "verified" as const,
          referenceId: `mock_${Date.now()}`,
          verifiedAt: new Date().toISOString(),
        },
      } as const;
    }

    // ─── LIVE MODE ──────────────────────────────────────────────────
    try {
      const res = await fetch(`${baseUrl}/v1/identity/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ktp_url: ktpSigned.data.signedUrl,
          selfie_url: selfieSigned.data.signedUrl,
          enable_liveness: true,
          enable_ocr: true,
          enable_face_match: true,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        return { ok: false, provider: "privy", error: `Privy ${res.status}: ${JSON.stringify(json)}` } as const;
      }
      return { ok: true, provider: "privy", mode: "live" as const, userId, result: json } as const;
    } catch (e) {
      return { ok: false, provider: "privy", error: (e as Error).message } as const;
    }
  });
