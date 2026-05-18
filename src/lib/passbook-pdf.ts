import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dfmt = (d: string | Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export interface PassbookData {
  anggota: {
    nama: string;
    nomor: string | null;
    nik: string | null;
    email: string | null;
    no_hp: string | null;
    status: string;
    joined_at: string | null;
  };
  koperasi: { nama: string; alamat?: string };
  periode: { from: string; to: string };
  summary: { totalIn: number; totalOut: number; saldoAkhir: number };
  rows: Array<{
    tanggal: string;
    jenis: string;
    keterangan: string;
    arah: "in" | "out";
    masuk: number;
    keluar: number;
    saldo: number;
  }>;
}

export async function buildPassbookPdf(d: PassbookData): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(d.koperasi.nama.toUpperCase(), pageW / 2, 18, { align: "center" });
  doc.setFontSize(11);
  doc.text("BUKU BESAR ANGGOTA / PASSBOOK DIGITAL", pageW / 2, 25, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  if (d.koperasi.alamat) doc.text(d.koperasi.alamat, pageW / 2, 30, { align: "center" });
  doc.line(14, 33, pageW - 14, 33);

  // Identitas
  let y = 40;
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("IDENTITAS ANGGOTA", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nama        : ${d.anggota.nama}`, 14, y); y += 5;
  doc.text(`No. Anggota : ${d.anggota.nomor ?? "-"}`, 14, y); y += 5;
  doc.text(`NIK         : ${d.anggota.nik ?? "-"}`, 14, y); y += 5;
  doc.text(`Email       : ${d.anggota.email ?? "-"}`, 14, y); y += 5;
  doc.text(`Telepon     : ${d.anggota.no_hp ?? "-"}`, 14, y); y += 5;
  doc.text(`Status      : ${d.anggota.status}`, 14, y); y += 5;
  doc.text(`Bergabung   : ${d.anggota.joined_at ? dfmt(d.anggota.joined_at) : "-"}`, 14, y); y += 5;
  doc.text(`Periode     : ${dfmt(d.periode.from)}  s/d  ${dfmt(d.periode.to)}`, 14, y); y += 8;

  // QR validasi
  try {
    const qrPayload = JSON.stringify({
      type: "passbook",
      member: d.anggota.nomor,
      from: d.periode.from,
      to: d.periode.to,
      generated: new Date().toISOString(),
    });
    const qrUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 120 });
    doc.addImage(qrUrl, "PNG", pageW - 44, 40, 30, 30);
    doc.setFontSize(7); doc.text("QR Validasi", pageW - 29, 73, { align: "center" });
  } catch { /* ignore qr error */ }

  // Ringkasan
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("RINGKASAN", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Total Masuk  : ${fmt.format(d.summary.totalIn)}`, 14, y); y += 5;
  doc.text(`Total Keluar : ${fmt.format(d.summary.totalOut)}`, 14, y); y += 5;
  doc.text(`Saldo Akhir  : ${fmt.format(d.summary.saldoAkhir)}`, 14, y); y += 4;

  // Tabel mutasi
  autoTable(doc, {
    startY: y + 2,
    head: [["Tanggal", "Jenis", "Keterangan", "Masuk", "Keluar", "Saldo"]],
    body: d.rows.map((r) => [
      dfmt(r.tanggal),
      r.jenis,
      r.keterangan,
      r.masuk ? fmt.format(r.masuk) : "-",
      r.keluar ? fmt.format(r.keluar) : "-",
      fmt.format(r.saldo),
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 80, 160], textColor: 255 },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(120);
    doc.text(
      `Dokumen dibuat ${new Date().toLocaleString("id-ID")} — Halaman ${i}/${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  return doc;
}

export async function buildMemberCardPdf(p: {
  nama: string;
  nomor: string | null;
  status: string;
  joined_at: string | null;
  foto_url: string | null;
  koperasi: string;
}): Promise<jsPDF> {
  // CR80 card landscape: 85.6mm x 54mm
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
  // Background
  doc.setFillColor(20, 40, 90);
  doc.rect(0, 0, 85.6, 54, "F");
  doc.setFillColor(35, 70, 150);
  doc.rect(0, 0, 85.6, 14, "F");

  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(p.koperasi.toUpperCase(), 4, 6);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text("KARTU ANGGOTA DIGITAL", 4, 10);

  // QR
  try {
    const qr = await QRCode.toDataURL(JSON.stringify({ type: "member", nomor: p.nomor, nama: p.nama }), { margin: 0, width: 200 });
    doc.addImage(qr, "PNG", 64, 18, 18, 18);
  } catch { /* ignore */ }

  // Foto
  if (p.foto_url) {
    try {
      const res = await fetch(p.foto_url);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, "JPEG", 4, 18, 16, 20);
    } catch { /* ignore */ }
  }

  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(p.nama, 23, 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text(`No. ${p.nomor ?? "-"}`, 23, 27);
  doc.text(`Status: ${p.status}`, 23, 31);
  doc.text(`Bergabung: ${p.joined_at ? dfmt(p.joined_at) : "-"}`, 23, 35);

  doc.setFontSize(6); doc.setTextColor(200);
  doc.text("Kartu ini bukti keanggotaan resmi koperasi. Validasi melalui QR.", 4, 50);

  return doc;
}