import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verifikasi identitas berbasis AI (Lovable AI Gateway).
 *
 * Penguatan keamanan v2:
 *  1. Cross-check OCR KTP dengan data profil anggota (NIK/nama/tgl_lahir/alamat).
 *  2. Validasi NIK ketat: 16 digit, kode provinsi valid, tgl lahir (digit 7-12)
 *     konsisten, jenis kelamin dari NIK (dd>40 = perempuan) dicocokkan dgn OCR.
 *  3. Dual-pass Gemini (2 panggilan dgn prompt berbeda) → skor wajah dirata-rata,
 *     selisih > 0.20 dipaksa pending_review.
 *  4. Threshold face match dinaikkan dari 0.75 → 0.80.
 *  5. Opsional selfie kedua (ekspresi berbeda) → AI memastikan orang sama TAPI
 *     bukan screenshot/cetakan (anti replay sederhana).
 */

// Kode provinsi NIK Indonesia yang valid.
const VALID_PROVINCE_CODES = new Set<string>([
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "21",
  "31", "32", "33", "34", "35", "36",
  "51", "52", "53",
  "61", "62", "63", "64", "65",
  "71", "72", "73", "74", "75", "76",
  "81", "82",
  "91", "92", "93", "94", "95", "96",
]);

interface NikAnalysis {
  format_valid: boolean;
  province_valid: boolean;
  dob_valid: boolean;
  parsed_dob: string | null;        // YYYY-MM-DD (estimasi, century guess)
  parsed_gender: "L" | "P" | null;  // dari NIK
  province_code: string | null;
}

function analyzeNik(nik: string): NikAnalysis {
  const out: NikAnalysis = {
    format_valid: false, province_valid: false, dob_valid: false,
    parsed_dob: null, parsed_gender: null, province_code: null,
  };
  if (!/^\d{16}$/.test(nik)) return out;
  out.format_valid = true;
  const prov = nik.slice(0, 2);
  out.province_code = prov;
  out.province_valid = VALID_PROVINCE_CODES.has(prov);

  let dd = parseInt(nik.slice(6, 8), 10);
  const mm = parseInt(nik.slice(8, 10), 10);
  const yy = parseInt(nik.slice(10, 12), 10);
  let gender: "L" | "P" = "L";
  if (dd > 40) { dd -= 40; gender = "P"; }
  out.parsed_gender = gender;

  if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
    // Tebak abad: thn 2-digit > tahun sekarang%100 → 19xx, selain itu 20xx.
    const nowYY = new Date().getFullYear() % 100;
    const fullYear = yy > nowYY ? 1900 + yy : 2000 + yy;
    const d = new Date(fullYear, mm - 1, dd);
    if (d.getDate() === dd && d.getMonth() === mm - 1) {
      out.dob_valid = true;
      out.parsed_dob = `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return out;
}

/** Normalisasi string utk perbandingan fuzzy (lowercase, hapus non-alfanumerik). */
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** Skor kemiripan sederhana: Jaccard atas token huruf. */
function nameSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).match(/.{1,3}/g) ?? []);
  const tb = new Set(norm(b).match(/.{1,3}/g) ?? []);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

interface AiResult {
  nik: string; nama: string; tempat_lahir: string; tgl_lahir: string;
  jenis_kelamin: string; alamat: string; face_match_score: number;
  liveness: "passed" | "failed"; ktp_quality: "good" | "blur" | "unreadable";
  notes: string;
}

async function callGemini(opts: {
  apiKey: string;
  ktpUrl: string;
  selfieUrl: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ ok: true; data: AiResult } | { ok: false; error: string; status?: number }> {
  const schema = {
    type: "object",
    properties: {
      nik: { type: "string" }, nama: { type: "string" },
      tempat_lahir: { type: "string" }, tgl_lahir: { type: "string" },
      jenis_kelamin: { type: "string", enum: ["L", "P", ""] },
      alamat: { type: "string" },
      face_match_score: { type: "number", minimum: 0, maximum: 1 },
      liveness: { type: "string", enum: ["passed", "failed"] },
      ktp_quality: { type: "string", enum: ["good", "blur", "unreadable"] },
      notes: { type: "string" },
    },
    required: ["nik", "nama", "tempat_lahir", "tgl_lahir", "jenis_kelamin",
      "alamat", "face_match_score", "liveness", "ktp_quality", "notes"],
    additionalProperties: false,
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: [
          { type: "text", text: opts.userPrompt },
          { type: "image_url", image_url: { url: opts.ktpUrl } },
          { type: "image_url", image_url: { url: opts.selfieUrl } },
        ] },
      ],
      tools: [{ type: "function", function: {
        name: "submit_verification", description: "Submit hasil verifikasi identitas", parameters: schema,
      } }],
      tool_choice: { type: "function", function: { name: "submit_verification" } },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: `AI ${res.status}: ${txt.slice(0, 200)}` };
  }
  const json = await res.json() as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) return { ok: false, error: "AI tidak mengembalikan hasil terstruktur." };
  return { ok: true, data: JSON.parse(argsStr) as AiResult };
}

/** Pass tambahan: bandingkan 2 selfie utk deteksi screenshot/cetakan. */
async function compareTwoSelfies(opts: {
  apiKey: string; selfie1Url: string; selfie2Url: string;
}): Promise<{ same_person_score: number; replay_suspicious: boolean; notes: string } | null> {
  const schema = {
    type: "object",
    properties: {
      same_person_score: { type: "number", minimum: 0, maximum: 1 },
      replay_suspicious: { type: "boolean" },
      notes: { type: "string" },
    },
    required: ["same_person_score", "replay_suspicious", "notes"],
    additionalProperties: false,
  };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Anda memeriksa apakah 2 selfie ini benar-benar diambil live oleh orang yg sama, atau dicurigai sebagai screenshot/cetakan/foto layar (replay attack)." },
          { role: "user", content: [
            { type: "text", text: "Bandingkan 2 foto selfie berikut.\n- same_person_score (0-1): apakah orang yg sama?\n- replay_suspicious: true jika terlihat tanda screenshot/cetakan/moire/refleksi layar/identik 100% piksel.\n- notes: alasan singkat ≤120 char." },
            { type: "image_url", image_url: { url: opts.selfie1Url } },
            { type: "image_url", image_url: { url: opts.selfie2Url } },
          ] },
        ],
        tools: [{ type: "function", function: { name: "submit_liveness", description: "Submit hasil liveness", parameters: schema } }],
        tool_choice: { type: "function", function: { name: "submit_liveness" } },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json() as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
    const a = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!a) return null;
    return JSON.parse(a);
  } catch { return null; }
}

export const verifyWithPrivy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ktpPath: z.string().min(1).max(512),
      selfiePath: z.string().min(1).max(512),
      selfie2Path: z.string().min(1).max(512).optional(),
      bucket: z.string().min(1).max(64).default("verifikasi-pinjaman"),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const { supabase, userId } = context;

    if (!apiKey) {
      return { ok: false, provider: "ai", error: "LOVABLE_API_KEY belum diset." } as const;
    }

    // 1. Ambil data profil utk cross-check.
    const { data: profile } = await supabase
      .from("profiles")
      .select("nama_lengkap, nik, tanggal_lahir, alamat, jenis_kelamin")
      .eq("id", userId)
      .maybeSingle();

    // 2. Download foto-foto.
    const dlList = [data.ktpPath, data.selfiePath];
    if (data.selfie2Path) dlList.push(data.selfie2Path);
    const dls = await Promise.all(dlList.map((p) => supabase.storage.from(data.bucket).download(p)));
    if (dls.some((d) => d.error || !d.data)) {
      return { ok: false, provider: "ai", error: "Gagal membaca foto dari storage." } as const;
    }
    const toUrl = async (blob: Blob) => {
      const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      return `data:${blob.type || "image/jpeg"};base64,${b64}`;
    };
    const ktpUrl = await toUrl(dls[0].data!);
    const selfieUrl = await toUrl(dls[1].data!);
    const selfie2Url = dls[2]?.data ? await toUrl(dls[2].data) : null;

    // 3. Dual-pass: 2 prompt berbeda, rata-ratakan skor wajah.
    const systemPrompt = "Anda adalah verifikator identitas KTP Indonesia yang teliti. Jawab HANYA dalam JSON valid sesuai schema.";
    const userPromptA = `Analisis 2 foto: (1) KTP Indonesia, (2) Selfie pemohon.
Tugas:
1. OCR KTP → ekstrak: nik (16 digit), nama, tempat_lahir, tgl_lahir (YYYY-MM-DD), jenis_kelamin (L/P), alamat.
2. Bandingkan wajah di foto KTP vs selfie → face_match_score (0.00-1.00). Perhatikan struktur wajah, mata, hidung, bibir.
3. Liveness: apakah selfie tampak orang asli (bukan foto dari layar/cetakan)? → "passed" / "failed".
4. ktp_quality: "good" / "blur" / "unreadable".
5. notes: catatan singkat ≤120 char jika ada anomali.
PENTING: Jika KTP tidak terbaca, isi field kosong dan ktp_quality="unreadable".`;
    const userPromptB = `Verifikasi identitas. Foto 1 = KTP, Foto 2 = Selfie.
Kerjakan dgn pendekatan berbeda:
- Fokus OCR baris-per-baris KTP utk akurasi NIK 16 digit.
- Untuk face_match_score, evaluasi: bentuk dagu, jarak antar mata, alis, tulang pipi. Berikan skor konservatif (0-1).
- Liveness: cek refleksi layar, moire pattern, tepian cetakan, kontras tidak natural.
- Isi semua field schema.`;

    const [passA, passB] = await Promise.all([
      callGemini({ apiKey, ktpUrl, selfieUrl, systemPrompt, userPrompt: userPromptA }),
      callGemini({ apiKey, ktpUrl, selfieUrl, systemPrompt, userPrompt: userPromptB }),
    ]);
    if (!passA.ok) {
      if (passA.status === 429) return { ok: false, provider: "ai", error: "AI sedang sibuk. Coba lagi sebentar." } as const;
      if (passA.status === 402) return { ok: false, provider: "ai", error: "Kredit AI workspace habis. Hubungi admin." } as const;
      return { ok: false, provider: "ai", error: passA.error } as const;
    }
    // Pass B opsional — kalau gagal pakai pass A saja.
    const a = passA.data;
    const b = passB.ok ? passB.data : null;

    const scoreA = Math.max(0, Math.min(1, Number(a.face_match_score) || 0));
    const scoreB = b ? Math.max(0, Math.min(1, Number(b.face_match_score) || 0)) : scoreA;
    const avgScore = (scoreA + scoreB) / 2;
    const scoreDelta = Math.abs(scoreA - scoreB);

    // 4. Liveness selfie-2 (opsional).
    let livenessExtra: { same_person_score: number; replay_suspicious: boolean; notes: string } | null = null;
    if (selfie2Url) {
      livenessExtra = await compareTwoSelfies({ apiKey, selfie1Url: selfieUrl, selfie2Url });
    }

    // 5. Validasi NIK ketat.
    const nikAn = analyzeNik(a.nik || "");

    // 6. Cross-check dengan profil.
    const checks = {
      nik_match: profile?.nik ? norm(profile.nik) === norm(a.nik) : null,
      nama_similarity: profile?.nama_lengkap ? nameSimilarity(profile.nama_lengkap, a.nama) : null,
      tgl_lahir_match: profile?.tanggal_lahir && a.tgl_lahir ? profile.tanggal_lahir === a.tgl_lahir : null,
      gender_consistent: a.jenis_kelamin && nikAn.parsed_gender ? a.jenis_kelamin === nikAn.parsed_gender : null,
    };
    const profileMismatch =
      checks.nik_match === false ||
      (checks.nama_similarity !== null && checks.nama_similarity < 0.45) ||
      checks.tgl_lahir_match === false;

    // 7. Tentukan status final (threshold 0.80).
    const livenessPassed = a.liveness === "passed" && (!b || b.liveness === "passed");
    const nikFullyValid = nikAn.format_valid && nikAn.province_valid && nikAn.dob_valid && checks.gender_consistent !== false;
    const replaySuspect = livenessExtra?.replay_suspicious === true || (livenessExtra && livenessExtra.same_person_score < 0.5);

    let status: "verified" | "pending_review" | "rejected";
    if (a.ktp_quality === "unreadable" || (!livenessPassed && avgScore < 0.4) || replaySuspect) {
      status = "rejected";
    } else if (
      avgScore >= 0.80 &&
      livenessPassed &&
      nikFullyValid &&
      !profileMismatch &&
      scoreDelta <= 0.20
    ) {
      status = "verified";
    } else {
      status = "pending_review";
    }

    // Catatan agregat.
    const aggNotes: string[] = [];
    if (a.notes) aggNotes.push(a.notes);
    if (b?.notes && b.notes !== a.notes) aggNotes.push(`#2: ${b.notes}`);
    if (livenessExtra?.notes) aggNotes.push(`liveness2: ${livenessExtra.notes}`);
    if (!nikAn.province_valid && nikAn.format_valid) aggNotes.push(`Kode provinsi NIK tidak dikenal (${nikAn.province_code}).`);
    if (!nikAn.dob_valid && nikAn.format_valid) aggNotes.push("Tgl lahir di NIK tidak valid.");
    if (checks.gender_consistent === false) aggNotes.push("Jenis kelamin NIK ≠ OCR.");
    if (checks.nik_match === false) aggNotes.push("NIK ≠ profil anggota.");
    if (checks.nama_similarity !== null && checks.nama_similarity < 0.45) aggNotes.push(`Nama KTP tidak mirip profil (${(checks.nama_similarity * 100).toFixed(0)}%).`);
    if (checks.tgl_lahir_match === false) aggNotes.push("Tgl lahir KTP ≠ profil.");
    if (scoreDelta > 0.20) aggNotes.push(`Skor dua pass tidak konsisten (Δ ${(scoreDelta * 100).toFixed(0)}%).`);

    return {
      ok: true,
      provider: "ai",
      mode: "live" as const,
      userId,
      result: {
        nik: a.nik || "",
        nama: a.nama || "",
        tempat_lahir: a.tempat_lahir || "",
        tgl_lahir: a.tgl_lahir || "",
        jenis_kelamin: a.jenis_kelamin || "",
        alamat: a.alamat || "",
        face_match_score: Number(avgScore.toFixed(3)),
        face_match_score_a: Number(scoreA.toFixed(3)),
        face_match_score_b: Number(scoreB.toFixed(3)),
        face_match_delta: Number(scoreDelta.toFixed(3)),
        liveness: livenessPassed ? "passed" : "failed",
        ktp_quality: a.ktp_quality,
        notes: aggNotes.join(" • ").slice(0, 480),
        nik_format_valid: nikAn.format_valid,
        nik_province_valid: nikAn.province_valid,
        nik_dob_valid: nikAn.dob_valid,
        nik_parsed_dob: nikAn.parsed_dob,
        nik_parsed_gender: nikAn.parsed_gender,
        profile_checks: checks,
        liveness_extra: livenessExtra,
        status,
        referenceId: `ai_${Date.now()}_${userId.slice(0, 6)}`,
        verifiedAt: new Date().toISOString(),
      },
    } as const;
  });
