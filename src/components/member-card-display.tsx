import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  nama: string;
  nomor: string | null;
  foto_url: string | null;
  joined_at?: string | null;
  koperasiName?: string;
}

export function MemberCardDisplay({ nama, nomor, foto_url, joined_at, koperasiName = "T-COOL Koperasi" }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [fotoSigned, setFotoSigned] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(nomor ?? nama, { width: 220, margin: 0, color: { dark: "#065f46", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(null));
    if (foto_url) {
      if (foto_url.startsWith("http")) setFotoSigned(foto_url);
      else supabase.storage.from("avatars").createSignedUrl(foto_url, 600).then(({ data }) => setFotoSigned(data?.signedUrl ?? null));
    } else setFotoSigned(null);
  }, [nama, nomor, foto_url]);

  const initials = nama.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="flex justify-center">
      <div
        className="relative"
        style={{
          width: "86mm",
          height: "54mm",
          borderRadius: "4mm",
          overflow: "hidden",
          background: "linear-gradient(135deg, #ffffff 0%, #ecfdf5 55%, #d1fae5 100%)",
          color: "#064e3b",
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          boxShadow: "0 8px 24px rgba(0,0,0,.15)",
        }}
      >
        <div style={{ position: "absolute", top: "-20mm", right: "-20mm", width: "50mm", height: "50mm", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,.35), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-15mm", left: "-15mm", width: "40mm", height: "40mm", borderRadius: "50%", background: "radial-gradient(circle, rgba(5,150,105,.25), transparent 70%)" }} />

        <div style={{ position: "relative", padding: "3mm 4mm", display: "flex", alignItems: "center", gap: "2mm", borderBottom: "0.3mm solid rgba(6,95,70,.15)" }}>
          <div style={{ width: "8mm", height: "8mm", borderRadius: "2mm", background: "linear-gradient(135deg,#059669,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "4mm", boxShadow: "0 1mm 2mm rgba(5,150,105,.4)" }}>T</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: "3.2mm", fontWeight: 800, letterSpacing: ".2mm", color: "#064e3b" }}>{koperasiName}</div>
            <div style={{ fontSize: "2.2mm", color: "#047857", letterSpacing: ".4mm", textTransform: "uppercase" }}>Kartu Anggota</div>
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", padding: "3mm 4mm", gap: "3mm", height: "calc(100% - 14mm)" }}>
          <div style={{ width: "20mm", height: "26mm", borderRadius: "2mm", overflow: "hidden", border: "0.4mm solid #ffffff", boxShadow: "0 1mm 3mm rgba(6,95,70,.25)", background: "linear-gradient(135deg,#a7f3d0,#6ee7b7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {fotoSigned ? (
              <img src={fotoSigned} alt={nama} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "#065f46", fontWeight: 800, fontSize: "8mm" }}>{initials}</span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "2mm", color: "#059669", textTransform: "uppercase", letterSpacing: ".3mm" }}>Nama Anggota</div>
              <div style={{ fontSize: "3.2mm", fontWeight: 800, color: "#064e3b", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nama}</div>
              <div style={{ marginTop: "1.5mm", fontSize: "2mm", color: "#059669", textTransform: "uppercase", letterSpacing: ".3mm" }}>Nomor Anggota</div>
              <div style={{ fontSize: "3mm", fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#065f46" }}>{nomor ?? "—"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "2mm" }}>
              <div style={{ fontSize: "1.8mm", color: "#047857" }}>
                {joined_at && <>Bergabung {new Date(joined_at).toLocaleDateString("id-ID", { year: "numeric", month: "short" })}</>}
              </div>
              {qr && <img src={qr} alt="QR" style={{ width: "11mm", height: "11mm", borderRadius: "1mm", background: "#fff", padding: "0.5mm" }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}