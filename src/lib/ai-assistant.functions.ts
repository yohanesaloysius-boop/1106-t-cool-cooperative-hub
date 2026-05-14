import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

type ChatMessage = z.infer<typeof MessageSchema>;

const SYSTEM_PROMPT = `Kamu adalah "T-Cool Assistant", asisten virtual koperasi T-Cool yang ramah, sopan, dan informatif. Jawab dalam Bahasa Indonesia singkat dan jelas.

Tugasmu:
- Bantu anggota cek saldo simpanan & status pinjaman (data dikirim di context).
- Jelaskan simulasi pinjaman: cicilan flat = (pokok + pokok*bunga%/100*tenor) / tenor.
- Jawab FAQ koperasi: jenis simpanan (pokok/wajib/sukarela), syarat pinjaman, cara setor, SHU, rapat anggota.
- Jika pertanyaan di luar koperasi, arahkan kembali dengan sopan.
- JANGAN mengarang angka. Jika data tidak ada di context, katakan belum tersedia dan sarankan hubungi pengurus.

Kontak Customer Service (gunakan jika anggota butuh bantuan manusia, masalah teknis, verifikasi manual, atau kasus di luar kemampuanmu):
- WhatsApp CS T-COOL Koperasi: 0819 5917 1997
- Format saat menyebut: tampilkan nomor + link wa.me, contoh: "Hubungi CS via WhatsApp di 0819 5917 1997 (https://wa.me/6281959171997)".

Format jawaban: ringkas, gunakan poin bila perlu, sebut nominal dengan format Rp.`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch user context (saldo, pinjaman aktif, profil)
    const [profileRes, simpananRes, pinjamanRes] = await Promise.all([
      supabase.from("profiles").select("nama_lengkap,nomor_anggota,status").eq("id", userId).maybeSingle(),
      supabase.from("simpanan").select("jenis,nominal,status").eq("user_id", userId).is("deleted_at", null),
      supabase.from("pinjaman").select("nominal,tenor_bulan,bunga_persen,status,cicilan_per_bulan,total_bayar").eq("user_id", userId).is("deleted_at", null),
    ]);

    const verified = (simpananRes.data ?? []).filter((s) => s.status === "verified");
    const totalSimpanan = verified.reduce((acc, s) => acc + Number(s.nominal ?? 0), 0);
    const byJenis = verified.reduce<Record<string, number>>((acc, s) => {
      acc[s.jenis] = (acc[s.jenis] ?? 0) + Number(s.nominal ?? 0);
      return acc;
    }, {});

    const pinjamanAktif = (pinjamanRes.data ?? []).filter((p) => ["disbursed", "active", "approved"].includes(String(p.status)));

    const userContext = `Data anggota saat ini:
- Nama: ${profileRes.data?.nama_lengkap ?? "-"}
- Nomor anggota: ${profileRes.data?.nomor_anggota ?? "-"}
- Status keanggotaan: ${profileRes.data?.status ?? "-"}
- Total simpanan terverifikasi: Rp ${totalSimpanan.toLocaleString("id-ID")}
- Rincian simpanan: ${Object.entries(byJenis).map(([k, v]) => `${k}=Rp ${v.toLocaleString("id-ID")}`).join(", ") || "belum ada"}
- Pinjaman aktif: ${pinjamanAktif.length === 0 ? "tidak ada" : pinjamanAktif.map((p) => `Rp ${Number(p.nominal).toLocaleString("id-ID")} tenor ${p.tenor_bulan} bln, cicilan Rp ${Number(p.cicilan_per_bulan ?? 0).toLocaleString("id-ID")}/bln`).join("; ")}`;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: userContext },
      ...data.messages,
    ];

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "AI assistant belum terkonfigurasi. Hubungi pengurus.", error: true as const };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
        }),
      });

      if (res.status === 429) {
        return { reply: "Permintaan terlalu banyak. Coba beberapa saat lagi.", error: true as const };
      }
      if (res.status === 402) {
        return { reply: "Kuota AI habis. Hubungi pengurus untuk top-up.", error: true as const };
      }
      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error", res.status, text);
        return { reply: "Terjadi gangguan pada layanan AI. Coba lagi nanti.", error: true as const };
      }

      const json = await res.json();
      const reply = json?.choices?.[0]?.message?.content ?? "Maaf, saya belum bisa menjawab itu.";
      return { reply: String(reply), error: false as const };
    } catch (err) {
      console.error("askAssistant failed", err);
      return { reply: "Tidak dapat terhubung ke AI. Periksa koneksi Anda.", error: true as const };
    }
  });
