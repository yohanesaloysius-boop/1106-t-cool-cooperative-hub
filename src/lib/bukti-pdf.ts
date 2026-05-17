import { buildSignedReportPdf } from "./report-pdf";

const fmtRp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

export async function downloadBuktiSimpanan(opts: {
  id: string;
  jenis: string;
  nominal: number;
  tanggal: string | Date;
  catatan?: string | null;
  verified_at?: string | null;
  anggota: { nama: string; nomor?: string | null; email?: string | null };
}) {
  const doc = await buildSignedReportPdf({
    title: "Bukti Setoran Simpanan",
    subtitle: `${opts.jenis.toUpperCase()} • ${fmtRp(opts.nominal)}`,
    period: fmtDate(opts.tanggal),
    verifyId: opts.id,
    sections: [
      {
        title: "Data Anggota",
        head: ["Field", "Nilai"],
        body: [
          ["Nama", opts.anggota.nama],
          ["Nomor Anggota", opts.anggota.nomor ?? "-"],
          ["Email", opts.anggota.email ?? "-"],
        ],
      },
      {
        title: "Detail Transaksi",
        head: ["Field", "Nilai"],
        body: [
          ["Jenis Simpanan", opts.jenis],
          ["Nominal", fmtRp(opts.nominal)],
          ["Tanggal Setor", fmtDate(opts.tanggal)],
          ["Diverifikasi", opts.verified_at ? fmtDate(opts.verified_at) : "Belum diverifikasi"],
          ["Catatan", opts.catatan ?? "-"],
        ],
      },
    ],
    signatures: [{ role: "Bendahara", name: "T-COOL Koperasi" }],
  });
  doc.save(`bukti-simpanan-${opts.jenis}-${opts.id.slice(0, 8)}.pdf`);
}

export async function downloadSuratPinjaman(opts: {
  id: string;
  nominal: number;
  tenor_bulan: number;
  bunga_persen: number;
  cicilan_per_bulan?: number | null;
  total_bayar?: number | null;
  status: string;
  approved_at?: string | null;
  disbursed_at?: string | null;
  tujuan?: string | null;
  anggota: { nama: string; nomor?: string | null; email?: string | null; alamat?: string | null };
}) {
  const isCair = !!opts.disbursed_at;
  const title = isCair ? "Surat Pencairan Pinjaman" : "Surat Persetujuan Pinjaman";
  const doc = await buildSignedReportPdf({
    title,
    subtitle: `${fmtRp(opts.nominal)} • ${opts.tenor_bulan} bulan`,
    period: opts.approved_at ? fmtDate(opts.approved_at) : fmtDate(new Date()),
    verifyId: opts.id,
    sections: [
      {
        title: "Data Peminjam",
        head: ["Field", "Nilai"],
        body: [
          ["Nama", opts.anggota.nama],
          ["Nomor Anggota", opts.anggota.nomor ?? "-"],
          ["Email", opts.anggota.email ?? "-"],
          ["Alamat", opts.anggota.alamat ?? "-"],
        ],
      },
      {
        title: "Rincian Pinjaman",
        head: ["Field", "Nilai"],
        body: [
          ["Pokok Pinjaman", fmtRp(opts.nominal)],
          ["Tenor", `${opts.tenor_bulan} bulan`],
          ["Bunga", `${opts.bunga_persen}% / bulan (flat)`],
          ["Cicilan / Bulan", opts.cicilan_per_bulan ? fmtRp(Number(opts.cicilan_per_bulan)) : "-"],
          ["Total Bayar", opts.total_bayar ? fmtRp(Number(opts.total_bayar)) : "-"],
          ["Tujuan", opts.tujuan ?? "-"],
          ["Status", opts.status],
          ["Disetujui", opts.approved_at ? fmtDate(opts.approved_at) : "-"],
          ["Dicairkan", opts.disbursed_at ? fmtDate(opts.disbursed_at) : "-"],
        ],
      },
    ],
    signatures: [
      { role: "Ketua", name: "T-COOL Koperasi" },
      { role: "Bendahara", name: "T-COOL Koperasi" },
      { role: "Peminjam", name: opts.anggota.nama },
    ],
  });
  doc.save(`surat-pinjaman-${opts.id.slice(0, 8)}.pdf`);
}
