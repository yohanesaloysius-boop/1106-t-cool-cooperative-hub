import jsPDF from "jspdf";
import type { KoperasiInfo } from "./adart-pdf";

export type LetterType =
  | "keterangan_anggota"
  | "rekomendasi_pinjaman"
  | "keterangan_usaha"
  | "lainnya";

export interface LetterAnggota {
  nama: string; nomor_anggota?: string | null; nik?: string | null;
  alamat?: string | null; no_hp?: string | null; joined_at?: string | null;
  pekerjaan?: string | null;
}

export interface LetterData {
  type: LetterType;
  nomorSurat: string;
  tanggal: string; // ISO
  perihal: string;
  isi?: string; // override body
  koperasi: KoperasiInfo;
  anggota: LetterAnggota;
  extra?: Record<string, string | number | null | undefined>;
  ttd?: { jabatan: string; nama: string };
}

const TYPE_LABEL: Record<LetterType, string> = {
  keterangan_anggota: "SURAT KETERANGAN ANGGOTA",
  rekomendasi_pinjaman: "SURAT REKOMENDASI PINJAMAN",
  keterangan_usaha: "SURAT KETERANGAN USAHA",
  lainnya: "SURAT RESMI",
};

function defaultBody(d: LetterData): string {
  const a = d.anggota;
  const joined = a.joined_at ? new Date(a.joined_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
  switch (d.type) {
    case "keterangan_anggota":
      return `Yang bertanda tangan di bawah ini, Pengurus ${d.koperasi.nama}, dengan ini menerangkan dengan sebenarnya bahwa nama tersebut di atas adalah benar anggota aktif ${d.koperasi.nama} sejak tanggal ${joined} dengan nomor anggota ${a.nomor_anggota ?? "-"}.\n\nSurat keterangan ini diberikan untuk dipergunakan sebagaimana mestinya.`;
    case "rekomendasi_pinjaman": {
      const nominal = d.extra?.nominal ? `sebesar Rp ${Number(d.extra.nominal).toLocaleString("id-ID")}` : "";
      const tujuan = d.extra?.tujuan ? ` untuk keperluan ${d.extra.tujuan}` : "";
      return `Berdasarkan catatan keanggotaan dan track record pembayaran simpanan/angsuran, Pengurus ${d.koperasi.nama} memberikan REKOMENDASI kepada anggota tersebut di atas untuk pengajuan fasilitas pinjaman ${nominal}${tujuan}.\n\nAnggota dinyatakan memiliki reputasi BAIK dan tidak memiliki tunggakan signifikan pada koperasi.\n\nSurat rekomendasi ini diberikan untuk dipergunakan sebagaimana mestinya.`;
    }
    case "keterangan_usaha":
      return `Yang bertanda tangan di bawah ini menerangkan bahwa anggota tersebut di atas adalah pemilik / pengelola usaha "${d.extra?.nama_usaha ?? "-"}" yang berlokasi di ${d.extra?.lokasi_usaha ?? a.alamat ?? "-"}, dan terdaftar sebagai pelaku UMKM binaan ${d.koperasi.nama}.`;
    default:
      return d.isi ?? "";
  }
}

export function buildLetterPdf(d: LetterData): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // KOP
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(d.koperasi.nama.toUpperCase(), pageW / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (d.koperasi.alamat) doc.text(d.koperasi.alamat, pageW / 2, 24, { align: "center" });
  const meta = [
    d.koperasi.nomor_badan_hukum ? `Badan Hukum: ${d.koperasi.nomor_badan_hukum}` : null,
    d.koperasi.telepon ? `Telp: ${d.koperasi.telepon}` : null,
    d.koperasi.email ? `Email: ${d.koperasi.email}` : null,
  ].filter(Boolean).join(" • ");
  if (meta) doc.text(meta, pageW / 2, 29, { align: "center" });
  doc.setLineWidth(0.8); doc.line(14, 32, pageW - 14, 32);
  doc.setLineWidth(0.2); doc.line(14, 33.5, pageW - 14, 33.5);

  // Title
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  const title = TYPE_LABEL[d.type];
  doc.text(title, pageW / 2, 44, { align: "center" });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Nomor: ${d.nomorSurat}`, pageW / 2, 50, { align: "center" });

  let y = 62;
  const ensureSpace = (needed = 12) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = 18;
    }
  };
  const tgl = new Date(d.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  doc.setFontSize(10);
  doc.text(`Perihal : ${d.perihal}`, 14, y); y += 8;

  // Anggota block
  doc.text("Yang bertanda tangan di bawah ini menerangkan data anggota berikut:", 14, y); y += 8;
  const rows: Array<[string, string]> = [
    ["Nama", d.anggota.nama],
    ["No. Anggota", d.anggota.nomor_anggota ?? "-"],
    ["NIK", d.anggota.nik ?? "-"],
    ["Alamat", d.anggota.alamat ?? "-"],
    ["No. HP", d.anggota.no_hp ?? "-"],
    ["Pekerjaan", d.anggota.pekerjaan ?? "-"],
  ];
  for (const [k, v] of rows) {
    const line = `${k.padEnd(13, " ")} : ${v}`;
    const lines = doc.splitTextToSize(line, pageW - 32);
    ensureSpace(lines.length * 5 + 2);
    doc.text(lines, 18, y); y += lines.length * 5;
  }
  y += 4;

  const body = d.isi?.trim() || defaultBody(d);
  const paragraphs = body.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const bodyLines = doc.splitTextToSize(paragraph, pageW - 28);
    for (const line of bodyLines) {
      ensureSpace(6);
      doc.text(line, 14, y);
      y += 5;
    }
    y += 3;
  }
  y += 7;

  // TTD
  ensureSpace(42);
  const sigX = pageW - 75;
  doc.text(`${d.koperasi.alamat?.split(",")[0] ?? "-"}, ${tgl}`, sigX, y); y += 6;
  doc.text(d.ttd?.jabatan ?? "Pengurus", sigX, y); y += 22;
  doc.setFont("helvetica", "bold");
  doc.text(`( ${d.ttd?.nama ?? d.koperasi.ketua ?? "-"} )`, sigX, y);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Halaman ${i}/${pages} — ${d.koperasi.nama}`, pageW / 2, pageH - 8, { align: "center" });
    doc.setTextColor(0);
  }

  return doc;
}
