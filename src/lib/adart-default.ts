import type { AdartContent, AdartPasal, KoperasiInfo } from "@/lib/adart-pdf";

/** Nilai default aturan koperasi (selaras dengan modul Pengaturan & migrasi sistem). */
export interface KoperasiRules {
  simpanan_pokok: number;
  simpanan_wajib: number;
  pinjaman_bunga_persen: number;
  pinjaman_bunga_jenis: string;
  pinjaman_tenor_max: number;
  shu_jasa_modal: number;
  shu_jasa_usaha: number;
  shu_dana_cadangan: number;
  shu_dana_sosial: number;
  shu_pengurus: number;
  shu_penalti_tunggakan: number;
  tabungan_3bln: number;
  tabungan_6bln: number;
  tabungan_12bln: number;
  tabungan_24bln: number;
  reward_setor_wajib: number;
  reward_hadir_rapat: number;
  reward_lunas_pinjaman: number;
  reward_referral: number;
  reward_loyalitas_persen: number;
}

export const DEFAULT_RULES: KoperasiRules = {
  simpanan_pokok: 100000,
  simpanan_wajib: 25000,
  pinjaman_bunga_persen: 1.5,
  pinjaman_bunga_jenis: "flat",
  pinjaman_tenor_max: 24,
  shu_jasa_modal: 40,
  shu_jasa_usaha: 40,
  shu_dana_cadangan: 20,
  shu_dana_sosial: 0,
  shu_pengurus: 0,
  shu_penalti_tunggakan: 20,
  tabungan_3bln: 0.4,
  tabungan_6bln: 0.5,
  tabungan_12bln: 0.6,
  tabungan_24bln: 0.75,
  reward_setor_wajib: 10,
  reward_hadir_rapat: 20,
  reward_lunas_pinjaman: 50,
  reward_referral: 100,
  reward_loyalitas_persen: 5,
};

function num(map: Record<string, unknown>, key: string, fallback: number): number {
  const raw = map[key];
  if (raw === null || raw === undefined) return fallback;
  const n = typeof raw === "string" ? Number(raw.replace(/[^0-9.\-]/g, "")) : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(map: Record<string, unknown>, key: string, fallback: string): string {
  const raw = map[key];
  if (typeof raw === "string" && raw.trim()) return raw.replace(/^"|"$/g, "");
  return fallback;
}

/** Bangun aturan koperasi dari baris tabel settings (key/value). */
export function rulesFromSettings(rows: { key: string; value: unknown }[] | null | undefined): KoperasiRules {
  const m: Record<string, unknown> = {};
  (rows ?? []).forEach((r) => { m[r.key] = r.value; });
  return {
    simpanan_pokok: num(m, "simpanan.pokok_min", DEFAULT_RULES.simpanan_pokok),
    simpanan_wajib: num(m, "simpanan.wajib_bulanan", DEFAULT_RULES.simpanan_wajib),
    pinjaman_bunga_persen: num(m, "pinjaman.bunga_persen", DEFAULT_RULES.pinjaman_bunga_persen),
    pinjaman_bunga_jenis: str(m, "pinjaman.bunga_jenis", DEFAULT_RULES.pinjaman_bunga_jenis),
    pinjaman_tenor_max: num(m, "pinjaman.tenor_max", DEFAULT_RULES.pinjaman_tenor_max),
    shu_jasa_modal: num(m, "shu.persen_jasa_modal", DEFAULT_RULES.shu_jasa_modal),
    shu_jasa_usaha: num(m, "shu.persen_jasa_usaha", DEFAULT_RULES.shu_jasa_usaha),
    shu_dana_cadangan: num(m, "shu.persen_dana_cadangan", DEFAULT_RULES.shu_dana_cadangan),
    shu_dana_sosial: num(m, "shu.persen_dana_sosial", DEFAULT_RULES.shu_dana_sosial),
    shu_pengurus: num(m, "shu.persen_pengurus", DEFAULT_RULES.shu_pengurus),
    shu_penalti_tunggakan: num(m, "shu.penalti_tunggakan_persen", DEFAULT_RULES.shu_penalti_tunggakan),
    tabungan_3bln: num(m, "tabungan_berjangka.bunga_3bln", DEFAULT_RULES.tabungan_3bln),
    tabungan_6bln: num(m, "tabungan_berjangka.bunga_6bln", DEFAULT_RULES.tabungan_6bln),
    tabungan_12bln: num(m, "tabungan_berjangka.bunga_12bln", DEFAULT_RULES.tabungan_12bln),
    tabungan_24bln: num(m, "tabungan_berjangka.bunga_24bln", DEFAULT_RULES.tabungan_24bln),
    reward_setor_wajib: num(m, "rewards.poin_setor_wajib", DEFAULT_RULES.reward_setor_wajib),
    reward_hadir_rapat: num(m, "rewards.poin_hadir_rapat", DEFAULT_RULES.reward_hadir_rapat),
    reward_lunas_pinjaman: num(m, "rewards.poin_lunas_pinjaman", DEFAULT_RULES.reward_lunas_pinjaman),
    reward_referral: num(m, "rewards.poin_referral", DEFAULT_RULES.reward_referral),
    reward_loyalitas_persen: num(m, "rewards.loyalitas_persen", DEFAULT_RULES.reward_loyalitas_persen),
  };
}

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

/** Susun dokumen AD/ART lengkap berdasarkan aturan koperasi yang berlaku di sistem. */
export function buildDefaultAdart(koperasi: KoperasiInfo, rules: KoperasiRules = DEFAULT_RULES): AdartContent {
  const nama = koperasi.nama || "Koperasi T-COOL";
  const pasal: AdartPasal[] = [
    // ===================== ANGGARAN DASAR =====================
    { bab: "BAB I — NAMA, TEMPAT KEDUDUKAN, DAN JANGKA WAKTU", isi:
      `Pasal 1. Koperasi ini bernama ${nama}, selanjutnya disebut "Koperasi".\n` +
      `Pasal 2. Koperasi berkedudukan di ${koperasi.alamat || "wilayah kerja yang ditetapkan pengurus"}` +
      `${koperasi.nomor_badan_hukum ? `, dengan Badan Hukum Nomor ${koperasi.nomor_badan_hukum}` : ""}.\n` +
      `Pasal 3. Koperasi didirikan untuk jangka waktu yang tidak terbatas.` },

    { bab: "BAB II — LANDASAN, ASAS, DAN PRINSIP", isi:
      "Pasal 4. Koperasi berlandaskan Pancasila dan Undang-Undang Dasar 1945 serta berdasar atas asas kekeluargaan.\n" +
      "Pasal 5. Koperasi melaksanakan prinsip: (a) keanggotaan sukarela dan terbuka; (b) pengelolaan secara demokratis; " +
      "(c) pembagian Sisa Hasil Usaha (SHU) secara adil sebanding dengan jasa usaha masing-masing anggota; " +
      "(d) pemberian balas jasa terbatas terhadap modal; (e) kemandirian; (f) pendidikan perkoperasian; dan (g) kerja sama antar koperasi." },

    { bab: "BAB III — MAKSUD DAN TUJUAN", isi:
      "Pasal 6. Koperasi bertujuan memajukan kesejahteraan anggota pada khususnya dan masyarakat pada umumnya, " +
      "serta ikut membangun tatanan perekonomian nasional.\n" +
      "Pasal 7. Untuk mencapai tujuan tersebut, Koperasi menyelenggarakan usaha: simpanan, pinjaman/pembiayaan, " +
      "tabungan berjangka, marketplace/perdagangan anggota, jasa pengadaan, serta usaha lain yang sah dan menguntungkan anggota." },

    { bab: "BAB IV — KEANGGOTAAN", isi:
      "Pasal 8. Anggota adalah Warga Negara Indonesia yang cakap hukum, menyetujui Anggaran Dasar dan Anggaran Rumah Tangga ini, " +
      "serta telah melengkapi data diri (Nama, NIK 16 digit, alamat, nomor HP, email) dan mengunggah KTP.\n" +
      "Pasal 9. Keanggotaan sah setelah pendaftaran diverifikasi dan disetujui pengurus, serta yang bersangkutan menandatangani AD/ART secara elektronik.\n" +
      "Pasal 10. Keanggotaan berakhir karena: (a) meninggal dunia; (b) mengundurkan diri; (c) diberhentikan pengurus karena melanggar AD/ART; " +
      "atau (d) sebab lain menurut peraturan yang berlaku." },

    { bab: "BAB V — HAK DAN KEWAJIBAN ANGGOTA", isi:
      "Pasal 11. Setiap anggota berkewajiban: (a) membayar simpanan pokok dan simpanan wajib; (b) mematuhi AD/ART serta keputusan rapat anggota; " +
      "(c) berpartisipasi dalam kegiatan usaha Koperasi; dan (d) menjaga nama baik Koperasi.\n" +
      "Pasal 12. Setiap anggota berhak: (a) memperoleh pelayanan Koperasi; (b) menghadiri dan memberikan suara dalam Rapat Anggota; " +
      "(c) memilih dan dipilih menjadi pengurus/pengawas; (d) memperoleh bagian SHU; dan (e) memperoleh keterangan mengenai perkembangan Koperasi." },

    { bab: "BAB VI — SIMPANAN ANGGOTA", isi:
      `Pasal 13. Simpanan Pokok sebesar ${rp(rules.simpanan_pokok)} dibayar satu kali saat menjadi anggota dan tidak dapat ditarik selama menjadi anggota.\n` +
      `Pasal 14. Simpanan Wajib sebesar ${rp(rules.simpanan_wajib)} per bulan wajib disetor setiap anggota.\n` +
      "Pasal 15. Simpanan Sukarela dapat disetor dan ditarik sesuai ketentuan, dan diperhitungkan dalam pembagian SHU sesuai bobotnya." },

    { bab: "BAB VII — PINJAMAN / PEMBIAYAAN", isi:
      `Pasal 16. Koperasi memberikan pinjaman kepada anggota dengan bunga ${rules.pinjaman_bunga_persen}% per bulan ` +
      `(jenis ${rules.pinjaman_bunga_jenis}) dan tenor maksimum ${rules.pinjaman_tenor_max} bulan.\n` +
      "Pasal 17. Permohonan pinjaman diajukan melalui sistem, diverifikasi, dan disetujui pengurus berdasarkan kelayakan, riwayat, dan kemampuan bayar anggota.\n" +
      "Pasal 18. Pinjaman dapat memerlukan penjamin dan/atau akad yang ditandatangani anggota. Anggota wajib membayar angsuran tepat waktu. " +
      "Keterlambatan dapat dikenakan tindakan penagihan dan memengaruhi perolehan SHU." },

    { bab: "BAB VIII — TABUNGAN BERJANGKA", isi:
      "Pasal 19. Koperasi menyediakan tabungan berjangka dengan imbal hasil per bulan: " +
      `tenor 3 bulan ${rules.tabungan_3bln}%, 6 bulan ${rules.tabungan_6bln}%, 12 bulan ${rules.tabungan_12bln}%, dan 24 bulan ${rules.tabungan_24bln}%.\n` +
      "Pasal 20. Penarikan sebelum jatuh tempo tunduk pada ketentuan yang ditetapkan pengurus." },

    { bab: "BAB IX — SISA HASIL USAHA (SHU)", isi:
      "Pasal 21. SHU adalah pendapatan Koperasi dalam satu tahun buku dikurangi biaya, penyusutan, dan kewajiban lain.\n" +
      `Pasal 22. SHU dialokasikan sebagai berikut: Jasa Modal ${rules.shu_jasa_modal}%, Jasa Usaha ${rules.shu_jasa_usaha}%, ` +
      `Dana Cadangan ${rules.shu_dana_cadangan}%` +
      `${rules.shu_dana_sosial ? `, Dana Sosial ${rules.shu_dana_sosial}%` : ""}` +
      `${rules.shu_pengurus ? `, Jasa Pengurus ${rules.shu_pengurus}%` : ""}.\n` +
      "Pasal 23. Jasa Modal dibagi menurut besarnya simpanan anggota; Jasa Usaha dibagi menurut partisipasi transaksi anggota " +
      "(bunga pinjaman dibayar, belanja marketplace, tabungan berjangka).\n" +
      `Pasal 24. Anggota yang memiliki tunggakan angsuran dapat dikenakan potongan SHU sebesar ${rules.shu_penalti_tunggakan}%.` },

    { bab: "BAB X — REWARD & LOYALITAS ANGGOTA", isi:
      "Pasal 25. Koperasi memberikan poin reward atas keaktifan anggota: " +
      `setor simpanan wajib tepat waktu ${rules.reward_setor_wajib} poin, kehadiran rapat ${rules.reward_hadir_rapat} poin, ` +
      `pelunasan pinjaman tepat waktu ${rules.reward_lunas_pinjaman} poin, dan referral anggota baru aktif ${rules.reward_referral} poin.\n` +
      `Pasal 26. Anggota dengan masa keanggotaan dan keaktifan tertentu berhak atas bonus loyalitas sebesar ${rules.reward_loyalitas_persen}% dari SHU dasar.` },

    { bab: "BAB XI — PERANGKAT ORGANISASI", isi:
      "Pasal 27. Perangkat organisasi Koperasi terdiri atas Rapat Anggota, Pengurus (Ketua, Sekretaris, Bendahara), dan Pengawas.\n" +
      "Pasal 28. Rapat Anggota merupakan pemegang kekuasaan tertinggi. Rapat Anggota Tahunan (RAT) diselenggarakan untuk mengesahkan " +
      "laporan pertanggungjawaban pengurus, laporan keuangan, pembagian SHU, dan rencana kerja serta anggaran." },

    { bab: "BAB XII — MODAL KOPERASI", isi:
      "Pasal 29. Modal Koperasi berasal dari modal sendiri (simpanan pokok, simpanan wajib, dana cadangan, dan hibah) " +
      "serta modal pinjaman yang sah.\n" +
      "Pasal 30. Dana Cadangan dipergunakan untuk memupuk modal dan menutup kerugian Koperasi." },

    // ===================== ANGGARAN RUMAH TANGGA =====================
    { bab: "BAB XIII — TATA TERTIB & DISIPLIN ANGGOTA (ART)", isi:
      "Pasal 31. Anggota wajib menjaga kerahasiaan akun, menggunakan data yang benar, dan tidak menyalahgunakan layanan Koperasi.\n" +
      "Pasal 32. Pelanggaran terhadap AD/ART dapat dikenakan sanksi berupa teguran, penghentian sementara layanan, hingga pemberhentian keanggotaan " +
      "sesuai keputusan pengurus." },

    { bab: "BAB XIV — LAYANAN DIGITAL & MARKETPLACE (ART)", isi:
      "Pasal 33. Anggota dapat mengakses layanan digital Koperasi: simpanan, pinjaman, tabungan berjangka, SHU, marketplace, dan dokumen secara daring.\n" +
      "Pasal 34. Transaksi marketplace antar anggota tunduk pada ketentuan jual beli, escrow, dan penyelesaian komplain yang ditetapkan Koperasi." },

    { bab: "BAB XV — PERUBAHAN AD/ART & PENUTUP (ART)", isi:
      "Pasal 35. Perubahan Anggaran Dasar dan Anggaran Rumah Tangga hanya dapat dilakukan melalui Rapat Anggota.\n" +
      "Pasal 36. Hal-hal yang belum diatur dalam dokumen ini akan diatur lebih lanjut dalam peraturan khusus yang ditetapkan pengurus " +
      "sepanjang tidak bertentangan dengan AD/ART dan peraturan perundang-undangan.\n" +
      "Pasal 37. Dengan menandatangani dokumen ini, anggota menyatakan telah membaca, memahami, dan menyetujui seluruh isi AD/ART " +
      `${nama} serta bersedia mematuhinya.` },
  ];

  return { version: "1.0", updated_at: new Date().toISOString(), pasal };
}
