// Pemetaan alur/struktur sistem T-COOL Koperasi ke AD/ART, SOP, dan Job Desk Pengurus.
// Sumber kebenaran tunggal — dipakai halaman /tata-kelola dan generator PDF.

export interface MapItem {
  /** Fitur/alur nyata di sistem */
  fitur: string;
  /** Klasifikasi: masuk AD/ART (aturan main) atau SOP (prosedur operasional) */
  jenis: "AD/ART" | "SOP" | "AD/ART + SOP";
  /** Pasal/aturan main yang relevan (jika AD/ART) */
  adart?: string;
  /** Ringkasan langkah SOP (jika SOP) */
  sop?: string;
}

export interface DomainMap {
  id: string;
  judul: string;
  ringkas: string;
  items: MapItem[];
}

export interface JobDesk {
  jabatan: string;
  ringkas: string;
  adart: string[];
  sop: string[];
}

export const TATA_KELOLA_DOMAINS: DomainMap[] = [
  {
    id: "keanggotaan-simpanan",
    judul: "Keanggotaan & Simpanan",
    ringkas:
      "Alur pendaftaran, verifikasi/approval anggota, serta simpanan pokok, wajib, dan sukarela.",
    items: [
      {
        fitur: "Pendaftaran anggota (form daftar, verifikasi email, unggah KTP)",
        jenis: "AD/ART + SOP",
        adart:
          "Syarat keanggotaan (WNI cakap hukum, melengkapi data NIK/alamat/HP/email + KTP) dan keanggotaan sah setelah disetujui pengurus serta menandatangani AD/ART secara elektronik.",
        sop:
          "1) Calon isi form daftar -> 2) verifikasi email -> 3) login & lengkapi profil + unggah KTP/foto/tanda tangan -> 4) status 'pending'.",
      },
      {
        fitur: "Approval anggota oleh pengurus (Kelola Anggota)",
        jenis: "SOP",
        sop:
          "Notifikasi masuk ke pengurus -> cek kelengkapan & keabsahan data -> setujui (status 'active') atau tolak dengan alasan. Hanya sekretaris/pimpinan yang memproses.",
      },
      {
        fitur: "Simpanan pokok & simpanan wajib (besaran)",
        jenis: "AD/ART",
        adart:
          "Besaran Simpanan Pokok (sekali, tidak ditarik selama jadi anggota) dan Simpanan Wajib bulanan ditetapkan dalam AD/ART dan hanya diubah lewat Rapat Anggota.",
      },
      {
        fitur: "Setoran simpanan, auto-debet wajib, buku tabungan",
        jenis: "SOP",
        sop:
          "Pencatatan setoran/penarikan, jadwal auto-debet simpanan wajib, penerbitan bukti & passbook. Verifikasi oleh bendahara.",
      },
      {
        fitur: "Tabungan berjangka (imbal hasil per tenor)",
        jenis: "AD/ART + SOP",
        adart: "Tersedianya layanan tabungan berjangka & dasar pemberian imbal hasil terbatas terhadap modal.",
        sop: "Pembukaan tenor, perhitungan imbal hasil, ketentuan penarikan sebelum jatuh tempo.",
      },
      {
        fitur: "Berakhirnya keanggotaan (keluar/diberhentikan)",
        jenis: "AD/ART",
        adart:
          "Sebab berakhirnya keanggotaan (meninggal, mengundurkan diri, diberhentikan karena melanggar AD/ART) dan pengembalian hak simpanan.",
      },
    ],
  },
  {
    id: "pinjaman-shu",
    judul: "Pinjaman & SHU",
    ringkas: "Pengajuan, verifikasi, akad, angsuran/penagihan, hingga pembagian Sisa Hasil Usaha.",
    items: [
      {
        fitur: "Bunga, tenor maksimum, jenis bunga pinjaman",
        jenis: "AD/ART",
        adart:
          "Besaran bunga, jenis (flat/menurun), dan tenor maksimum ditetapkan dalam AD/ART; perubahan melalui Rapat Anggota.",
      },
      {
        fitur: "Pengajuan & verifikasi pinjaman (wizard, scoring, penjamin)",
        jenis: "SOP",
        sop:
          "1) Anggota ajukan via wizard -> 2) sistem hitung kelayakan/scoring -> 3) verifikasi berkas & penjamin -> 4) keputusan pengurus berdasarkan kemampuan bayar.",
      },
      {
        fitur: "Akad/perjanjian pinjaman + tanda tangan elektronik",
        jenis: "AD/ART + SOP",
        adart: "Kewajiban akad ditandatangani anggota dan dapat memerlukan penjamin.",
        sop: "Penerbitan dokumen akad, tanda tangan elektronik, pencairan dana, arsip akad.",
      },
      {
        fitur: "Angsuran, penagihan, sanksi keterlambatan",
        jenis: "AD/ART + SOP",
        adart:
          "Kewajiban membayar angsuran tepat waktu; keterlambatan dapat dikenakan tindakan penagihan dan memengaruhi perolehan SHU.",
        sop: "Jadwal angsuran, reminder otomatis, eskalasi penagihan, pencatatan tunggakan.",
      },
      {
        fitur: "Formula & alokasi pembagian SHU",
        jenis: "AD/ART",
        adart:
          "Persentase alokasi SHU (jasa modal, jasa usaha, dana cadangan, dana sosial, jasa pengurus) dan dasar pembagian per anggota ditetapkan AD/ART.",
      },
      {
        fitur: "Perhitungan & distribusi SHU tahunan",
        jenis: "SOP",
        sop:
          "Tutup buku -> hitung SHU per anggota (bobot simpanan & partisipasi transaksi) -> potong penalti tunggakan -> distribusi & laporan.",
      },
    ],
  },
  {
    id: "marketplace-pengadaan",
    judul: "Marketplace & Pengadaan",
    ringkas: "Toko anggota, transaksi & escrow, komplain, serta jasa pengadaan (gereja/sekolah).",
    items: [
      {
        fitur: "Hak membuka toko & bertransaksi (anggota aktif)",
        jenis: "AD/ART",
        adart:
          "Usaha marketplace/perdagangan antar anggota sebagai bagian usaha koperasi; akses transaksi hanya untuk anggota aktif.",
      },
      {
        fitur: "Verifikasi penjual, escrow, pelepasan dana, komplain",
        jenis: "SOP",
        sop:
          "Verifikasi toko -> dana pembeli ditahan escrow -> barang diterima -> pelepasan dana ke penjual; alur komplain & penyelesaian sengketa.",
      },
      {
        fitur: "Fee/biaya layanan marketplace & pengadaan",
        jenis: "AD/ART + SOP",
        adart: "Dasar pengenaan biaya jasa/fee koperasi atas transaksi & pengadaan.",
        sop: "Persentase fee, pemotongan otomatis, pencatatan pendapatan jasa.",
      },
      {
        fitur: "Jasa pengadaan (Purchase Request -> PO -> serah terima)",
        jenis: "AD/ART + SOP",
        adart: "Koperasi sebagai penyedia jasa pengadaan dengan fee yang ditetapkan.",
        sop:
          "PR diajukan -> approval keuangan -> fee dihitung & dikunci -> pilih vendor -> PO -> pembayaran -> catat fee -> serah terima (bukti & tanda tangan).",
      },
    ],
  },
  {
    id: "tata-kelola-pengurus",
    judul: "Tata Kelola & Pengurus",
    ringkas: "Perangkat organisasi, kewenangan pengurus, RBAC, audit log, rapat & voting.",
    items: [
      {
        fitur: "Perangkat organisasi (Rapat Anggota, Pengurus, Pengawas)",
        jenis: "AD/ART",
        adart:
          "Rapat Anggota sebagai kekuasaan tertinggi; susunan & wewenang Pengurus (Ketua, Sekretaris, Bendahara) dan Pengawas.",
      },
      {
        fitur: "Pembagian kewenangan akses (RBAC per jabatan)",
        jenis: "AD/ART + SOP",
        adart: "Pemisahan tugas & wewenang pengurus sebagai prinsip pengendalian internal.",
        sop:
          "Peta akses menu/route per jabatan (pimpinan/keuangan/sekretariat); pengelolaan role hanya oleh super admin untuk cegah eskalasi hak.",
      },
      {
        fitur: "Audit log / catatan aktivitas",
        jenis: "SOP",
        sop:
          "Setiap aksi penting (login, kelola anggota, transaksi, perubahan permission) tercatat otomatis; hanya pimpinan yang dapat melihat & mengekspor log.",
      },
      {
        fitur: "Rapat Anggota Tahunan (RAT) & voting",
        jenis: "AD/ART + SOP",
        adart:
          "RAT mengesahkan laporan pertanggungjawaban, laporan keuangan, pembagian SHU, dan rencana kerja/anggaran.",
        sop: "Penyelenggaraan voting/survei daring, kuorum, rekap hasil, dan arsip keputusan.",
      },
      {
        fitur: "Laporan keuangan (buku besar, kas, RAT, SAK, RAPB)",
        jenis: "SOP",
        sop: "Pencatatan akuntansi berkelanjutan & penyusunan laporan periodik untuk RAT dan pengawasan.",
      },
    ],
  },
];

export const JOB_DESK_PENGURUS: JobDesk[] = [
  {
    jabatan: "Ketua / Super Admin (Pimpinan)",
    ringkas: "Pemimpin operasional koperasi dengan akses penuh sistem.",
    adart: [
      "Memimpin koperasi sesuai AD/ART & keputusan Rapat Anggota.",
      "Mewakili koperasi di dalam & luar pengadilan.",
      "Bertanggung jawab atas jalannya organisasi & pelaporan ke RAT.",
    ],
    sop: [
      "Akses penuh seluruh menu; satu-satunya yang mengelola role/izin (super admin).",
      "Menyetujui kebijakan, pengaturan sistem, backup, dan audit.",
      "Memantau audit log & kinerja koperasi.",
    ],
  },
  {
    jabatan: "Sekretaris",
    ringkas: "Administrasi & kesekretariatan anggota.",
    adart: [
      "Menyelenggarakan administrasi & dokumentasi organisasi.",
      "Menyiapkan rapat dan menyimpan arsip keputusan.",
    ],
    sop: [
      "Kelola anggota & approval pendaftaran.",
      "Surat-menyurat, survei, voting, lowongan, notifikasi WA, dan support.",
    ],
  },
  {
    jabatan: "Bendahara",
    ringkas: "Pengelolaan keuangan koperasi.",
    adart: [
      "Bertanggung jawab atas pengelolaan & keamanan keuangan.",
      "Menyusun laporan keuangan untuk RAT.",
    ],
    sop: [
      "Kelola simpanan, pinjaman, akad, verifikasi, angsuran, penagihan.",
      "Buku besar/kas, rekonsiliasi, QRIS, tabungan berjangka, dana cadangan, SHU, penjamin.",
      "Aset, OPEX, dan seluruh laporan keuangan (analitik, RAT, SAK, RAPB).",
    ],
  },
  {
    jabatan: "Pengawas",
    ringkas: "Pengawasan jalannya koperasi.",
    adart: [
      "Mengawasi pelaksanaan kebijakan & pengelolaan koperasi.",
      "Membuat laporan hasil pengawasan kepada Rapat Anggota.",
    ],
    sop: ["Mengakses laporan & audit log untuk verifikasi kepatuhan (read-only)."],
  },
];