import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import QRCode from "qrcode";

export interface ReportSection {
  title: string;
  head: string[];
  body: RowInput[];
}

export interface ReportSignature {
  role: string;     // e.g. "Ketua"
  name: string;
  dataUrl?: string; // PNG signature image
}

export interface BuildReportOptions {
  title: string;
  subtitle?: string;
  period?: string;
  sections: ReportSection[];
  signatures?: ReportSignature[];
  verifyId: string;        // unique id for QR
  verifyBaseUrl?: string;  // e.g. window.location.origin + "/verify"
}

export async function buildSignedReportPdf(opts: BuildReportOptions): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("T-COOL KOPERASI", 14, 18);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(opts.title, 14, 25);
  doc.setFontSize(9); doc.setTextColor(110);
  if (opts.period) doc.text(`Periode: ${opts.period}`, 14, 31);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 36);
  doc.setTextColor(0);

  let y = 44;
  for (const s of opts.sections) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(s.title, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [s.head],
      body: s.body,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error lastAutoTable from autotable plugin
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
    if (y > pageH - 80) { doc.addPage(); y = 20; }
  }

  // Signatures
  if (opts.signatures?.length) {
    if (y > pageH - 70) { doc.addPage(); y = 20; }
    const slotW = (pageW - 28) / opts.signatures.length;
    opts.signatures.forEach((sig, i) => {
      const x = 14 + slotW * i;
      doc.setFontSize(9); doc.setTextColor(80);
      doc.text(sig.role, x + slotW / 2, y, { align: "center" });
      if (sig.dataUrl) {
        try { doc.addImage(sig.dataUrl, "PNG", x + slotW / 2 - 20, y + 4, 40, 18); } catch { /* ignore */ }
      } else {
        doc.setDrawColor(180); doc.line(x + 10, y + 22, x + slotW - 10, y + 22);
      }
      doc.setTextColor(0); doc.setFont("helvetica", "bold");
      doc.text(sig.name, x + slotW / 2, y + 30, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
      doc.text(new Date().toLocaleDateString("id-ID"), x + slotW / 2, y + 35, { align: "center" });
    });
    y += 42;
  }

  // QR verification
  const verifyUrl = `${opts.verifyBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "")}/verify/${opts.verifyId}`;
  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
    const qrSize = 28;
    const qrX = pageW - 14 - qrSize;
    const qrY = pageH - 14 - qrSize;
    doc.addImage(qr, "PNG", qrX, qrY, qrSize, qrSize);
    doc.setFontSize(7); doc.setTextColor(110);
    doc.text("Scan untuk verifikasi", qrX + qrSize / 2, qrY - 2, { align: "center" });
    doc.text(opts.verifyId.slice(0, 16).toUpperCase(), qrX + qrSize / 2, qrY + qrSize + 4, { align: "center" });
  } catch { /* ignore */ }

  // Footer
  doc.setFontSize(8); doc.setTextColor(140);
  doc.text("Dokumen ini sah secara elektronik. Verifikasi via QR code.", 14, pageH - 8);

  return doc;
}
