import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AkadData {
  nomorAkad: string;
  tanggal: string; // ISO
  anggota: { nama: string; nomor: string | null; nik: string | null; alamat: string | null };
  pinjaman: { nominal: number; tenor_bulan: number; bunga_persen: number; bunga_jenis: string; cicilan_per_bulan: number; total_bayar: number; tujuan: string | null };
  koperasi: { nama: string; alamat?: string };
  memberSignature?: { dataUrl: string; name: string; signedAt: string };
  pengurusSignature?: { dataUrl: string; name: string; jabatan: string; signedAt: string };
}

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function buildAkadPdf(d: AkadData): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const tglStr = new Date(d.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("AKAD PERJANJIAN PINJAMAN", pageW / 2, 20, { align: "center" });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Nomor: ${d.nomorAkad}`, pageW / 2, 27, { align: "center" });

  let y = 38;
  doc.setFontSize(10);
  doc.text(`Pada hari ini, ${tglStr}, telah disepakati perjanjian pinjaman antara:`, 14, y);
  y += 8;

  // Parties
  doc.setFont("helvetica", "bold"); doc.text("PIHAK PERTAMA (Pemberi Pinjaman):", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nama  : ${d.koperasi.nama}`, 18, y); y += 5;
  if (d.koperasi.alamat) { doc.text(`Alamat: ${d.koperasi.alamat}`, 18, y); y += 5; }
  y += 3;
  doc.setFont("helvetica", "bold"); doc.text("PIHAK KEDUA (Penerima Pinjaman):", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nama        : ${d.anggota.nama}`, 18, y); y += 5;
  doc.text(`No. Anggota : ${d.anggota.nomor ?? "-"}`, 18, y); y += 5;
  doc.text(`NIK         : ${d.anggota.nik ?? "-"}`, 18, y); y += 5;
  if (d.anggota.alamat) {
    const lines = doc.splitTextToSize(`Alamat      : ${d.anggota.alamat}`, pageW - 32);
    doc.text(lines, 18, y); y += lines.length * 5;
  }
  y += 4;

  // Detail
  doc.setFont("helvetica", "bold"); doc.text("DETAIL PINJAMAN", 14, y); y += 2;
  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    head: [["Uraian", "Nilai"]],
    body: [
      ["Pokok Pinjaman", fmt.format(d.pinjaman.nominal)],
      ["Tenor", `${d.pinjaman.tenor_bulan} bulan`],
      ["Bunga", `${d.pinjaman.bunga_persen}% (${d.pinjaman.bunga_jenis})`],
      ["Cicilan per Bulan", fmt.format(d.pinjaman.cicilan_per_bulan)],
      ["Total yang Harus Dibayar", fmt.format(d.pinjaman.total_bayar)],
      ["Tujuan", d.pinjaman.tujuan ?? "-"],
    ],
    margin: { left: 14, right: 14 },
  });
  // @ts-expect-error autotable plugin
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Terms
  doc.setFont("helvetica", "bold"); doc.text("KETENTUAN", 14, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const terms = [
    "1. Pihak Kedua wajib membayar cicilan setiap bulan sesuai jadwal yang ditetapkan.",
    "2. Keterlambatan pembayaran dikenakan denda harian sesuai kebijakan koperasi yang berlaku.",
    "3. Pelunasan dipercepat diperbolehkan tanpa penalti.",
    "4. Apabila Pihak Kedua wanprestasi, koperasi berhak melakukan penagihan dan/atau memotong simpanan sukarela.",
    "5. Segala perselisihan diselesaikan secara musyawarah; apabila tidak tercapai, melalui forum Rapat Anggota.",
    "6. Akad ini ditandatangani secara digital dan memiliki kekuatan hukum yang sama dengan tanda tangan basah sesuai UU ITE.",
  ];
  for (const t of terms) {
    const lines = doc.splitTextToSize(t, pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5;
  }

  y += 6;
  if (y > 230) { doc.addPage(); y = 20; }

  // Signatures
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  const colW = (pageW - 28) / 2;
  doc.text("Pihak Pertama (Pengurus)", 14 + colW / 2, y, { align: "center" });
  doc.text("Pihak Kedua (Anggota)", 14 + colW + colW / 2, y, { align: "center" });

  if (d.pengurusSignature?.dataUrl) {
    try { doc.addImage(d.pengurusSignature.dataUrl, "PNG", 14 + colW / 2 - 20, y + 4, 40, 18); } catch { /* */ }
  } else {
    doc.setDrawColor(180); doc.line(14 + 10, y + 22, 14 + colW - 10, y + 22);
  }
  if (d.memberSignature?.dataUrl) {
    try { doc.addImage(d.memberSignature.dataUrl, "PNG", 14 + colW + colW / 2 - 20, y + 4, 40, 18); } catch { /* */ }
  } else {
    doc.setDrawColor(180); doc.line(14 + colW + 10, y + 22, 14 + 2 * colW - 10, y + 22);
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(d.pengurusSignature?.name ?? "_________________", 14 + colW / 2, y + 30, { align: "center" });
  doc.text(d.memberSignature?.name ?? d.anggota.nama, 14 + colW + colW / 2, y + 30, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
  doc.text(d.pengurusSignature?.jabatan ?? "Pengurus Koperasi", 14 + colW / 2, y + 35, { align: "center" });
  doc.text("Anggota", 14 + colW + colW / 2, y + 35, { align: "center" });
  if (d.memberSignature?.signedAt)
    doc.text(`Ditandatangani: ${new Date(d.memberSignature.signedAt).toLocaleString("id-ID")}`, 14 + colW + colW / 2, y + 40, { align: "center" });
  if (d.pengurusSignature?.signedAt)
    doc.text(`Ditandatangani: ${new Date(d.pengurusSignature.signedAt).toLocaleString("id-ID")}`, 14 + colW / 2, y + 40, { align: "center" });
  doc.setTextColor(0);

  return doc;
}

export async function akadPdfBlob(d: AkadData): Promise<Blob> {
  const doc = buildAkadPdf(d);
  return doc.output("blob");
}
