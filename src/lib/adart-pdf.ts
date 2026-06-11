import jsPDF from "jspdf";

export interface AdartPasal { bab: string; isi: string }
export interface AdartSection { heading: string; body: string }
export interface AdartContent { version: string; updated_at?: string; pasal?: AdartPasal[]; sections?: AdartSection[]; title?: string }
export interface KoperasiInfo {
  nama: string; alamat?: string; nomor_badan_hukum?: string;
  telepon?: string; email?: string; ketua?: string; sekretaris?: string;
}
export interface AdartSignature {
  dataUrl: string; fullName: string; hash: string; signedAt: string;
  nomorAnggota?: string | null; nik?: string | null;
}

const FALLBACK_PASAL: AdartPasal[] = [
  { bab: "Pasal 1 — Keanggotaan", isi: "Anggota wajib mematuhi seluruh ketentuan koperasi, membayar simpanan pokok, simpanan wajib, dan ikut serta dalam kegiatan koperasi." },
  { bab: "Pasal 2 — Hak & Kewajiban", isi: "Setiap anggota berhak menerima SHU, mengikuti RAT, dan menggunakan layanan koperasi sesuai ketentuan yang berlaku." },
  { bab: "Pasal 3 — Persetujuan", isi: "Dengan menandatangani dokumen ini, anggota menyatakan telah membaca, memahami, dan menyetujui seluruh isi AD/ART Koperasi T-COOL." },
];

function readText(source: unknown, keys: string[], fallback = ""): string {
  if (!source || typeof source !== "object") return fallback;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function normalizePasal(content: AdartContent): AdartPasal[] {
  const fromPasal = Array.isArray(content.pasal)
    ? content.pasal.map((item) => ({
      bab: readText(item, ["bab", "judul", "title", "heading"], "Pasal"),
      isi: readText(item, ["isi", "konten", "body", "content", "text", "description"]),
    }))
    : [];

  const fromSections = Array.isArray(content.sections)
    ? content.sections.map((item) => ({
      bab: readText(item, ["heading", "title", "bab", "judul"], "Pasal"),
      isi: readText(item, ["body", "content", "isi", "konten", "text", "description"]),
    }))
    : [];

  const valid = [...fromPasal, ...fromSections].filter((item) => item.bab || item.isi);
  return valid.length > 0 ? valid : FALLBACK_PASAL;
}

export function buildAdartPdf(
  koperasi: KoperasiInfo,
  content: AdartContent,
  signature?: AdartSignature,
): jsPDF {
  const pasal = normalizePasal(content);

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // KOP
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(koperasi.nama.toUpperCase(), pageW / 2, 18, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  if (koperasi.alamat) doc.text(koperasi.alamat, pageW / 2, 24, { align: "center" });
  const meta = [
    koperasi.nomor_badan_hukum ? `Badan Hukum: ${koperasi.nomor_badan_hukum}` : null,
    koperasi.telepon ? `Telp: ${koperasi.telepon}` : null,
    koperasi.email ? `Email: ${koperasi.email}` : null,
  ].filter(Boolean).join(" • ");
  if (meta) doc.text(meta, pageW / 2, 29, { align: "center" });
  doc.setLineWidth(0.6); doc.line(14, 32, pageW - 14, 32);

  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("ANGGARAN DASAR & ANGGARAN RUMAH TANGGA", pageW / 2, 42, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`Versi ${content.version}`, pageW / 2, 47, { align: "center" });

  let y = 56;
  for (const p of pasal) {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    const babLines = doc.splitTextToSize(p.bab || "Pasal", pageW - 28);
    doc.text(babLines, 14, y); y += babLines.length * 5 + 1;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const isiLines = doc.splitTextToSize(p.isi || "-", pageW - 28);
    if (y + isiLines.length * 5 > pageH - 25) { doc.addPage(); y = 20; }
    doc.text(isiLines, 14, y); y += isiLines.length * 5 + 5;
  }

  // Signature block
  if (signature) {
    if (y > pageH - 80) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("PERNYATAAN PERSETUJUAN ANGGOTA", 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const stmt = `Yang bertanda tangan di bawah ini menyatakan telah membaca, memahami, dan menyetujui seluruh isi Anggaran Dasar & Anggaran Rumah Tangga ${koperasi.nama} sebagaimana tercantum di atas, dan bersedia mematuhinya sebagai anggota.`;
    const stmtLines = doc.splitTextToSize(stmt, pageW - 28);
    doc.text(stmtLines, 14, y); y += stmtLines.length * 4.5 + 4;

    const sigX = pageW - 80;
    doc.text(`Tanggal: ${new Date(signature.signedAt).toLocaleString("id-ID")}`, sigX, y);
    try { doc.addImage(signature.dataUrl, "PNG", sigX, y + 3, 60, 24); } catch { /* ignore */ }
    y += 30;
    doc.setFont("helvetica", "bold");
    doc.text(signature.fullName, sigX, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    if (signature.nomorAnggota) { doc.text(`No. Anggota: ${signature.nomorAnggota}`, sigX, y); y += 4; }
    if (signature.nik) { doc.text(`NIK: ${signature.nik}`, sigX, y); y += 4; }
    doc.text(`Hash: ${signature.hash.slice(0, 32)}…`, sigX, y);
  }

  // Footer pagination
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Halaman ${i}/${pages} — ${koperasi.nama}`, pageW / 2, pageH - 8, { align: "center" });
    doc.setTextColor(0);
  }
  return doc;
}
