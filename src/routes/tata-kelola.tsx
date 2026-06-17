import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ScrollText, ListChecks, Users } from "lucide-react";
import { TATA_KELOLA_DOMAINS, JOB_DESK_PENGURUS } from "@/lib/tata-kelola-content";

export const Route = createFileRoute("/tata-kelola")({
  head: () => ({
    meta: [
      { title: "Aturan Main: AD/ART, SOP & Job Desk — T-COOL Koperasi" },
      {
        name: "description",
        content:
          "Pemetaan alur & struktur sistem koperasi T-COOL ke dalam AD/ART (aturan main), SOP operasional, dan job desk pengurus.",
      },
    ],
  }),
  component: TataKelolaPage,
});

function jenisVariant(jenis: string): "default" | "secondary" | "outline" {
  if (jenis === "AD/ART") return "default";
  if (jenis === "SOP") return "secondary";
  return "outline";
}

async function downloadPdf() {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = 18;
  const ensure = (h: number) => { if (y + h > pageH - 14) { doc.addPage(); y = 18; } };
  const wrap = (text: string, size: number, bold = false, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageW - M * 2 - indent);
    ensure(lines.length * (size * 0.45) + 2);
    doc.text(lines, M + indent, y);
    y += lines.length * (size * 0.45) + 2;
  };

  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("T-COOL KOPERASI", pageW / 2, y, { align: "center" }); y += 7;
  doc.setFontSize(12);
  doc.text("Pemetaan AD/ART, SOP & Job Desk Pengurus", pageW / 2, y, { align: "center" }); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Dibuat: ${new Date().toLocaleDateString("id-ID")}`, pageW / 2, y, { align: "center" });
  doc.setTextColor(0); y += 8;
  doc.setLineWidth(0.5); doc.line(M, y, pageW - M, y); y += 8;

  TATA_KELOLA_DOMAINS.forEach((d, di) => {
    wrap(`${di + 1}. ${d.judul}`, 12, true);
    wrap(d.ringkas, 9);
    y += 1;
    d.items.forEach((it) => {
      wrap(`[${it.jenis}] ${it.fitur}`, 10, true, 2);
      if (it.adart) wrap(`AD/ART: ${it.adart}`, 9, false, 6);
      if (it.sop) wrap(`SOP: ${it.sop}`, 9, false, 6);
      y += 1;
    });
    y += 3;
  });

  ensure(10);
  wrap("Job Desk Pengurus", 12, true);
  JOB_DESK_PENGURUS.forEach((j) => {
    wrap(j.jabatan, 10, true, 2);
    wrap(j.ringkas, 9, false, 6);
    wrap("AD/ART (aturan main):", 9, true, 6);
    j.adart.forEach((a) => wrap(`• ${a}`, 9, false, 10));
    wrap("SOP (tugas operasional):", 9, true, 6);
    j.sop.forEach((s) => wrap(`• ${s}`, 9, false, 10));
    y += 3;
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Halaman ${i}/${pages} — T-COOL Koperasi`, pageW / 2, pageH - 8, { align: "center" });
    doc.setTextColor(0);
  }
  doc.save("AD-ART-SOP-JobDesk-TCOOL.pdf");
}

function TataKelolaPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="container mx-auto px-4 pt-16 pb-8 md:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Aturan Main Koperasi
          </span>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight">
            AD/ART, SOP & <span className="text-primary">Job Desk Pengurus</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Pemetaan setiap alur & fitur sistem T-COOL Koperasi ke dalam aturan main (AD/ART) dan
            prosedur operasional (SOP), beserta pembagian tugas pengurus.
          </p>
          <div className="mt-6">
            <Button onClick={downloadPdf} className="gap-2">
              <Download className="h-4 w-4" /> Unduh PDF
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Badge>AD/ART</Badge> aturan main — diubah lewat Rapat Anggota</span>
            <span className="inline-flex items-center gap-1.5"><Badge variant="secondary">SOP</Badge> prosedur operasional harian</span>
            <span className="inline-flex items-center gap-1.5"><Badge variant="outline">AD/ART + SOP</Badge> keduanya</span>
          </div>
        </div>
      </section>

      {TATA_KELOLA_DOMAINS.map((d, di) => (
        <section key={d.id} id={d.id} className="container mx-auto scroll-mt-24 px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{di + 1}. {d.judul}</h2>
              <p className="text-sm text-muted-foreground">{d.ringkas}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {d.items.map((it, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={jenisVariant(it.jenis)}>{it.jenis}</Badge>
                  <span className="font-semibold">{it.fitur}</span>
                </div>
                {it.adart && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground"><ScrollText className="h-3.5 w-3.5" /> AD/ART:</span>{" "}
                    {it.adart}
                  </p>
                )}
                {it.sop && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground"><ListChecks className="h-3.5 w-3.5" /> SOP:</span>{" "}
                    {it.sop}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section id="job-desk" className="container mx-auto scroll-mt-24 px-4 py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <Users className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Job Desk Pengurus</h2>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {JOB_DESK_PENGURUS.map((j) => (
            <div key={j.jabatan} className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h3 className="text-lg font-semibold">{j.jabatan}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{j.ringkas}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium"><ScrollText className="h-3.5 w-3.5" /> AD/ART (aturan main)</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {j.adart.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
              <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium"><ListChecks className="h-3.5 w-3.5" /> SOP (tugas operasional)</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {j.sop.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}