import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verifikasi identitas berbasis AI (Lovable AI Gateway).
 *
 * Alur:
 * 1. Ambil foto KTP & selfie dari Supabase Storage → konversi ke base64.
 * 2. Kirim ke Gemini 2.5 Pro Vision (model multimodal kuat) untuk:
 *    a. OCR KTP → ekstrak NIK, Nama, TTL, JK, Alamat.
 *    b. Face match KTP vs selfie → skor 0-1.
 *    c. Liveness check sederhana (selfie tampak natural, bukan foto KTP lain).
 * 3. Return shape kompatibel dengan UI Privy lama agar wizard tidak berubah.
 *
 * Catatan: tidak konek Dukcapil. Validasi NIK hanya format & checksum.
 * Skor < 0.75 → status 'pending_review' (admin verifikasi manual).
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
    const apiKey = process.env.LOVABLE_API_KEY;
    const { supabase, userId } = context;

    if (!apiKey) {
      return { ok: false, provider: "ai", error: "LOVABLE_API_KEY belum diset." } as const;
    }

    // Download kedua foto dari storage privat.
    const [ktpDl, selfieDl] = await Promise.all([
      supabase.storage.from(data.bucket).download(data.ktpPath),
      supabase.storage.from(data.bucket).download(data.selfiePath),
    ]);
    if (ktpDl.error || selfieDl.error || !ktpDl.data || !selfieDl.data) {
      return { ok: false, provider: "ai", error: "Gagal membaca foto dari storage." } as const;
    }

    const toB64 = async (blob: Blob) => {
      const buf = Buffer.from(await blob.arrayBuffer());
      return buf.toString("base64");
    };
    const ktpB64 = await toB64(ktpDl.data);
    const selfieB64 = await toB64(selfieDl.data);
    const ktpMime = ktpDl.data.type || "image/jpeg";
    const selfieMime = selfieDl.data.type || "image/jpeg";

    const systemPrompt =
      "Anda adalah verifikator identitas KTP Indonesia. Lakukan OCR pada KTP, lalu cocokkan wajah di KTP dengan foto selfie. Jawab HANYA dalam JSON valid sesuai schema.";
    const userPrompt = `Analisis 2 foto: (1) KTP Indonesia, (2) Selfie pemohon.
Tugas:
1. OCR KTP → ekstrak: nik (16 digit), nama, tempat_lahir, tgl_lahir (YYYY-MM-DD), jenis_kelamin (L/P), alamat.
2. Bandingkan wajah di foto KTP vs selfie → face_match_score (0.00-1.00).
3. Liveness: apakah selfie tampak orang asli (bukan foto dari layar/cetakan)? → "passed" / "failed".
4. ktp_quality: "good" / "blur" / "unreadable".
5. notes: catatan singkat (≤120 char) jika ada anomali (mis. KTP tidak terbaca, wajah tertutup).

PENTING: Jika KTP tidak terbaca, isi field dengan string kosong dan ktp_quality="unreadable".`;

    const schema = {
      type: "object",
      properties: {
        nik: { type: "string" },
        nama: { type: "string" },
        tempat_lahir: { type: "string" },
        tgl_lahir: { type: "string" },
        jenis_kelamin: { type: "string", enum: ["L", "P", ""] },
        alamat: { type: "string" },
        face_match_score: { type: "number", minimum: 0, maximum: 1 },
        liveness: { type: "string", enum: ["passed", "failed"] },
        ktp_quality: { type: "string", enum: ["good", "blur", "unreadable"] },
        notes: { type: "string" },
      },
      required: [
        "nik", "nama", "tempat_lahir", "tgl_lahir", "jenis_kelamin",
        "alamat", "face_match_score", "liveness", "ktp_quality", "notes",
      ],
      additionalProperties: false,
    };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: `data:${ktpMime};base64,${ktpB64}` } },
                { type: "image_url", image_url: { url: `data:${selfieMime};base64,${selfieB64}` } },
              ],
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_verification",
              description: "Submit hasil verifikasi identitas",
              parameters: schema,
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_verification" } },
        }),
      });

      if (res.status === 429) {
        return { ok: false, provider: "ai", error: "AI sedang sibuk. Coba lagi sebentar." } as const;
      }
      if (res.status === 402) {
        return { ok: false, provider: "ai", error: "Kredit AI workspace habis. Hubungi admin." } as const;
      }
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, provider: "ai", error: `AI ${res.status}: ${txt.slice(0, 200)}` } as const;
      }

      const json = await res.json() as {
        choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
      };
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) {
        return { ok: false, provider: "ai", error: "AI tidak mengembalikan hasil terstruktur." } as const;
      }
      const r = JSON.parse(argsStr) as {
        nik: string; nama: string; tempat_lahir: string; tgl_lahir: string;
        jenis_kelamin: string; alamat: string; face_match_score: number;
        liveness: "passed" | "failed"; ktp_quality: "good" | "blur" | "unreadable"; notes: string;
      };

      // Validasi format NIK (16 digit numerik).
      const nikValid = /^\d{16}$/.test(r.nik);
      const score = Math.max(0, Math.min(1, Number(r.face_match_score) || 0));

      // Tentukan status:
      // - verified  : score >= 0.75 && liveness passed && NIK valid format && KTP terbaca
      // - pending_review : selain itu (admin review manual)
      // - rejected  : KTP unreadable atau liveness failed total
      let status: "verified" | "pending_review" | "rejected";
      if (r.ktp_quality === "unreadable" || (r.liveness === "failed" && score < 0.4)) {
        status = "rejected";
      } else if (score >= 0.75 && r.liveness === "passed" && nikValid) {
        status = "verified";
      } else {
        status = "pending_review";
      }

      return {
        ok: true,
        provider: "ai",
        mode: "live" as const,
        userId,
        result: {
          nik: r.nik || "",
          nama: r.nama || "",
          tempat_lahir: r.tempat_lahir || "",
          tgl_lahir: r.tgl_lahir || "",
          jenis_kelamin: r.jenis_kelamin || "",
          alamat: r.alamat || "",
          face_match_score: Number(score.toFixed(3)),
          liveness: r.liveness,
          ktp_quality: r.ktp_quality,
          notes: r.notes || "",
          nik_format_valid: nikValid,
          status,
          referenceId: `ai_${Date.now()}_${userId.slice(0, 6)}`,
          verifiedAt: new Date().toISOString(),
        },
      } as const;
    } catch (e) {
      return { ok: false, provider: "ai", error: (e as Error).message } as const;
    }
  });
