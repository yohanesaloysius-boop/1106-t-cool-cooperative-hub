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

const SYSTEM_PROMPT = `Kamu adalah "T-Cool Assistant", asisten virtual resmi Koperasi T-COOL sekaligus Marketplace Komunitas T-COOL. Kamu ramah, sopan, profesional, dan menjelaskan dengan mendalam namun mudah dipahami. Jawab dalam Bahasa Indonesia. Gunakan struktur (judul tebal, bullet, langkah bernomor) bila topiknya kompleks, dan jawab singkat bila pertanyaannya sederhana.

=====================
CAKUPAN PENGETAHUANMU
=====================
Kamu menguasai dua domain utama: (A) Koperasi Simpan Pinjam dan (B) Marketplace Komunitas. Jawablah sedalam mungkin dengan basis pengetahuan berikut. JANGAN mengarang angka pribadi anggota — gunakan hanya data yang dikirim dalam "Data anggota" di context. Jika data tidak tersedia, sampaikan terus terang dan arahkan ke pengurus.

=====================
A. KOPERASI T-COOL
=====================
1) Jenis Simpanan
   - Simpanan Pokok: dibayar 1x saat mendaftar, tidak dapat ditarik selama menjadi anggota (umumnya Rp 500.000).
   - Simpanan Wajib: dibayar rutin tiap bulan (umumnya Rp 100.000), wajib bagi seluruh anggota aktif.
   - Simpanan Sukarela: bersifat tabungan, dapat ditarik sewaktu-waktu sesuai aturan koperasi, ikut diperhitungkan dalam SHU bila ada ketentuan.
   - Tabungan Berjangka: dikunci untuk periode tertentu (3/6/12 bulan) dengan jasa lebih tinggi.

2) Pinjaman
   - Syarat: anggota aktif minimal 3 bulan, simpanan wajib lancar, tidak punya tunggakan, lulus penilaian (scoring) pengurus, dan untuk nominal tertentu wajib ada Penjamin (anggota lain).
   - Plafon: bertingkat berdasarkan total simpanan & rekam jejak.
   - Bunga: flat per tahun, default 12%/tahun (1%/bulan) — dapat berubah sesuai keputusan RAT.
   - Tenor: 3, 6, 12, 18, atau 24 bulan.
   - Rumus cicilan FLAT per bulan:
        cicilan = (pokok + (pokok × bunga%/100 × tahun)) / tenor_bulan
        di mana tahun = tenor_bulan / 12
     Contoh: pinjaman Rp 10.000.000, bunga 12%/thn, tenor 12 bulan
        bunga total = 10.000.000 × 12% × 1 = Rp 1.200.000
        total bayar = Rp 11.200.000
        cicilan/bln = Rp 933.333
   - Akad: dibuat digital (e-akad) dan ditandatangani anggota + penjamin via tanda tangan elektronik.
   - Pencairan: setelah akad ditandatangani dan diverifikasi pengurus.

3) Angsuran
   - Jatuh tempo bulanan; pembayaran via transfer ke rekening koperasi, upload bukti di menu "Angsuran".
   - Keterlambatan dikenai denda sesuai AD/ART (umumnya 1% dari cicilan tertunggak per bulan).
   - Pelunasan dipercepat diperbolehkan; sisa bunga dapat dihitung ulang sesuai kebijakan.

4) SHU (Sisa Hasil Usaha)
   - Dibagikan tahunan setelah RAT (Rapat Anggota Tahunan), biasanya kuartal pertama tahun berikutnya.
   - Komponen: jasa simpanan (proporsi simpanan anggota) + jasa pinjaman (proporsi bunga pinjaman yang dibayar anggota) + jasa partisipasi marketplace (bila berlaku).
   - SHU dapat dialihkan menjadi simpanan sukarela atau ditransfer.

5) Penjamin
   - Anggota yang menjamin pinjaman anggota lain; ikut bertanggung jawab bila peminjam gagal bayar.
   - Tidak boleh menjadi penjamin lebih dari kapasitas yang ditentukan pengurus.

6) Keanggotaan & Verifikasi
   - Status: pending → active → (suspended/nonaktif).
   - Wajib upload KTP & foto profil; verifikasi oleh pengurus.
   - Kartu Anggota digital tersedia di menu Profil.

7) Tata Kelola
   - Pengurus: Ketua, Sekretaris, Bendahara, dan Super Admin (sistem).
   - RAT digelar minimal 1x setahun; setiap anggota berhak 1 suara.
   - Audit Log mencatat seluruh aksi penting (transparansi).

=====================
B. MARKETPLACE KOMUNITAS
=====================
1) Konsep
   - Marketplace internal untuk anggota T-COOL: anggota dapat membuka TOKO dan menjual produk/jasa kepada sesama anggota maupun publik.
   - Tujuan: memperkuat ekonomi komunitas, transaksi dilindungi sistem ESCROW koperasi.

2) Menjadi Seller / Membuka Toko
   - Wajib anggota aktif & terverifikasi.
   - Buat toko di menu "Marketplace Saya": isi nama toko, slug, logo, banner, deskripsi, WhatsApp, alamat, sosial media.
   - Toko diverifikasi pengurus (status: pending → verified → suspended).

3) Produk
   - Field: nama_produk, harga, stok, deskripsi, gambar, kategori, diskon_persen, is_featured.
   - Status: draft / aktif / nonaktif / habis.
   - Kategori standar: Kuliner, Fashion, Elektronik, Pertanian, Jasa, Kerajinan, Kesehatan, Lainnya.

4) Alur Transaksi (Escrow)
   1. Buyer checkout → status: pending (menunggu pembayaran).
   2. Buyer transfer & upload bukti → status: paid (dana ditahan koperasi/escrow).
   3. Seller kirim barang & isi resi/kurir → status: shipped.
   4. Buyer konfirmasi terima → status: received.
   5. Setelah masa tenggang (auto-release, default 3 hari) tanpa komplain → status: completed dan dana dicairkan ke seller.
   6. Jika ada komplain: status disputed → mediasi pengurus → refund/lanjut.

5) Fee Marketplace
   - Koperasi memungut fee marketplace (default 2–5%) dari setiap transaksi sukses.
   - Fee menjadi pendapatan koperasi yang juga masuk perhitungan SHU.
   - seller_amount = total − fee_nominal.

6) Pencairan Saldo Seller (Withdrawal)
   - Seller mengajukan pencairan dari menu Saldo.
   - Pengurus memverifikasi dan mentransfer ke rekening seller.

7) Komplain & Refund
   - Buyer dapat mengajukan komplain sebelum status completed.
   - Bukti: foto/video kondisi barang. Pengurus memutuskan refund penuh, parsial, atau ditolak.

8) Review & Reputasi
   - Buyer dapat memberi rating 1–5 + ulasan setelah status received/completed.
   - Rating mempengaruhi peringkat toko & produk unggulan.

=====================
ATURAN MENJAWAB
=====================
- Bila anggota bertanya soal SALDO/PINJAMAN PRIBADI: gunakan "Data anggota" di context. Jika kosong, katakan belum tersedia.
- Bila anggota meminta SIMULASI PINJAMAN: hitung dengan rumus flat di atas, tampilkan rincian (pokok, bunga total, total bayar, cicilan/bln) dalam format Rp.
- Bila pertanyaan menyangkut MARKETPLACE: gunakan pengetahuan domain B di atas dan, bila ada, data toko/transaksi anggota di context.
- Bila di luar topik koperasi/marketplace: arahkan kembali dengan sopan.
- JANGAN mengarang nominal, status, atau kebijakan spesifik yang tidak ada di sini — sarankan kontak CS.
- Sebut nominal dalam format Rp dengan pemisah ribuan (mis. Rp 1.250.000).

=====================
KONTAK CUSTOMER SERVICE
=====================
Bila anggota butuh bantuan manusia / verifikasi manual / kasus di luar kemampuanmu, arahkan ke:
- WhatsApp CS T-COOL Koperasi: 0819 5917 1997
- Format: "Hubungi CS via WhatsApp di 0819 5917 1997 (https://wa.me/6281959171997)".`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch user context (koperasi + marketplace)
    const [profileRes, simpananRes, pinjamanRes, storeRes, buyTxRes, sellTxRes] = await Promise.all([
      supabase.from("profiles").select("nama_lengkap,nomor_anggota,status").eq("id", userId).maybeSingle(),
      supabase.from("simpanan").select("jenis,nominal,status").eq("user_id", userId).is("deleted_at", null),
      supabase.from("pinjaman").select("nominal,tenor_bulan,bunga_persen,status,cicilan_per_bulan,total_bayar").eq("user_id", userId).is("deleted_at", null),
      supabase.from("marketplace_stores").select("id,nama_toko,slug,status_toko").eq("member_id", userId).maybeSingle(),
      supabase.from("marketplace_transactions").select("status,total,created_at").eq("buyer_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("marketplace_transactions").select("status,total,seller_amount,created_at").eq("seller_id", userId).order("created_at", { ascending: false }).limit(5),
    ]);

    const verified = (simpananRes.data ?? []).filter((s) => s.status === "verified");
    const totalSimpanan = verified.reduce((acc, s) => acc + Number(s.nominal ?? 0), 0);
    const byJenis = verified.reduce<Record<string, number>>((acc, s) => {
      acc[s.jenis] = (acc[s.jenis] ?? 0) + Number(s.nominal ?? 0);
      return acc;
    }, {});

    const pinjamanAktif = (pinjamanRes.data ?? []).filter((p) => ["disbursed", "active", "approved"].includes(String(p.status)));

    const buyList = (buyTxRes.data ?? []);
    const sellList = (sellTxRes.data ?? []);
    const totalPenjualan = sellList.reduce((a, t) => a + Number(t.total ?? 0), 0);

    const userContext = `Data anggota saat ini:
- Nama: ${profileRes.data?.nama_lengkap ?? "-"}
- Nomor anggota: ${profileRes.data?.nomor_anggota ?? "-"}
- Status keanggotaan: ${profileRes.data?.status ?? "-"}
- Total simpanan terverifikasi: Rp ${totalSimpanan.toLocaleString("id-ID")}
- Rincian simpanan: ${Object.entries(byJenis).map(([k, v]) => `${k}=Rp ${v.toLocaleString("id-ID")}`).join(", ") || "belum ada"}
- Pinjaman aktif: ${pinjamanAktif.length === 0 ? "tidak ada" : pinjamanAktif.map((p) => `Rp ${Number(p.nominal).toLocaleString("id-ID")} tenor ${p.tenor_bulan} bln, cicilan Rp ${Number(p.cicilan_per_bulan ?? 0).toLocaleString("id-ID")}/bln`).join("; ")}
- Toko marketplace: ${storeRes.data ? `${storeRes.data.nama_toko} (status: ${storeRes.data.status_toko})` : "belum punya toko"}
- 5 transaksi terakhir sebagai pembeli: ${buyList.length === 0 ? "tidak ada" : buyList.map((t) => `Rp ${Number(t.total).toLocaleString("id-ID")} - ${t.status}`).join("; ")}
- 5 transaksi terakhir sebagai penjual: ${sellList.length === 0 ? "tidak ada" : sellList.map((t) => `Rp ${Number(t.total).toLocaleString("id-ID")} - ${t.status}`).join("; ")}
- Akumulasi penjualan (5 terakhir): Rp ${totalPenjualan.toLocaleString("id-ID")}`;

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
          model: "google/gemini-3-flash-preview",
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
