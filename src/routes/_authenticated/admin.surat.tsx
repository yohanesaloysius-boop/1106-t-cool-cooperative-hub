import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildLetterPdf, type LetterType, type LetterAnggota } from "@/lib/letter-pdf";
import type { KoperasiInfo } from "@/lib/adart-pdf";
import { fitImageToSquare, type LogoFit, type LogoBg } from "@/lib/image-data";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/surat")({
  head: () => ({ meta: [{ title: "Surat Resmi — Admin" }] }),
  component: AdminSuratPage,
});

const LETTER_TYPES: { value: LetterType; label: string; perihal: string }[] = [
  { value: "keterangan_anggota", label: "Surat Keterangan Anggota", perihal: "Keterangan Keanggotaan" },
  { value: "rekomendasi_pinjaman", label: "Surat Rekomendasi Pinjaman", perihal: "Rekomendasi Pengajuan Pinjaman" },
  { value: "keterangan_usaha", label: "Surat Keterangan Usaha", perihal: "Keterangan Usaha Anggota" },
  { value: "lainnya", label: "Surat Lainnya (custom)", perihal: "Surat Resmi" },
];

const DEFAULT_KOPERASI: KoperasiInfo = {
  nama: "T-COOL Koperasi",
  alamat: "Center Park Blok 3 No. 3, Simpang Kara, Batam",
  telepon: "0819 5917 1997",
  email: "t-coolkoperasi@gmail.com",
  ketua: "Pengurus",
};

function genNomor(type: LetterType) {
  const prefix: Record<LetterType, string> = {
    keterangan_anggota: "SKA",
    rekomendasi_pinjaman: "SRP",
    keterangan_usaha: "SKU",
    lainnya: "SR",
  };
  const d = new Date();
  const rom = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][d.getMonth()];
  const seq = String(Date.now()).slice(-4);
  return `${seq}/${prefix[type]}/T-COOL/${rom}/${d.getFullYear()}`;
}

function AdminSuratPage() {
  const { user } = useAuth();
  const [type, setType] = useState<LetterType>("keterangan_anggota");
  const [memberId, setMemberId] = useState<string>("");
  const [nomor, setNomor] = useState(genNomor("keterangan_anggota"));
  const [perihal, setPerihal] = useState("Keterangan Keanggotaan");
  const [isi, setIsi] = useState("");
  const [extraNominal, setExtraNominal] = useState("");
  const [extraTujuan, setExtraTujuan] = useState("");
  const [extraUsaha, setExtraUsaha] = useState("");
  const [extraLokasi, setExtraLokasi] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = LETTER_TYPES.find((x) => x.value === type)!;
    setNomor(genNomor(type));
    setPerihal(t.perihal);
  }, [type]);

  const { data: members = [] } = useQuery({
    queryKey: ["letter-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,nama_lengkap,nomor_anggota,nik,alamat,no_hp,pekerjaan,joined_at")
        .eq("status", "active")
        .order("nama_lengkap")
        .limit(500);
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["letter-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value").eq("key", "koperasi_info").maybeSingle();
      if (error) return DEFAULT_KOPERASI;
      return ((data?.value as KoperasiInfo | null) ?? DEFAULT_KOPERASI);
    },
  });

  const { data: logo } = useQuery({
    queryKey: ["letter-logo"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("key,value").in("key", ["koperasi.logo_url", "koperasi.logo_fit", "koperasi.logo_bg"]);
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return {
        url: typeof map["koperasi.logo_url"] === "string" ? (map["koperasi.logo_url"] as string) : "",
        fit: (map["koperasi.logo_fit"] === "cover" ? "cover" : "contain") as LogoFit,
        bg: (map["koperasi.logo_bg"] === "white" ? "white" : "transparent") as LogoBg,
      };
    },
  });

  const { data: history = [], refetch } = useQuery({
    queryKey: ["letter-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("official_letters")
        .select("id,letter_type,nomor_surat,perihal,created_at,member_id,profiles:member_id(nama_lengkap)")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const selectedMember = useMemo(() => members.find((m) => m.id === memberId), [members, memberId]);

  const generate = async () => {
    if (!selectedMember) return toast.error("Pilih anggota dulu");
    const koperasiInfo = settings ?? DEFAULT_KOPERASI;
    setBusy(true);
    try {
      const anggota: LetterAnggota = {
        nama: selectedMember.nama_lengkap,
        nomor_anggota: selectedMember.nomor_anggota,
        nik: selectedMember.nik,
        alamat: selectedMember.alamat,
        no_hp: selectedMember.no_hp,
        pekerjaan: selectedMember.pekerjaan,
        joined_at: selectedMember.joined_at,
      };
      const extra: Record<string, string | number | undefined> = {};
      if (type === "rekomendasi_pinjaman") {
        extra.nominal = extraNominal ? Number(extraNominal) : undefined;
        extra.tujuan = extraTujuan || undefined;
      }
      if (type === "keterangan_usaha") {
        extra.nama_usaha = extraUsaha || undefined;
        extra.lokasi_usaha = extraLokasi || undefined;
      }
      const doc = buildLetterPdf({
        type, nomorSurat: nomor, tanggal: new Date().toISOString(),
        perihal, isi: isi || undefined, koperasi: koperasiInfo, anggota, extra,
        ttd: { jabatan: "Ketua", nama: koperasiInfo.ketua ?? "Pengurus" },
        logoDataUrl: await fitImageToSquare(logo?.url, logo?.fit ?? "contain", 240, logo?.bg ?? "transparent"),
      });
      doc.save(`${nomor.replace(/\//g, "-")}.pdf`);

      const { error } = await supabase.from("official_letters").insert({
        member_id: selectedMember.id,
        letter_type: type,
        nomor_surat: nomor,
        perihal,
        payload: { isi, extra },
        generated_by: user?.id,
      });
      if (error) {
        toast.warning("PDF berhasil diunduh, tetapi riwayat surat belum tersimpan.");
      } else {
        toast.success("Surat dibuat & dicatat");
        refetch();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generator Surat Resmi</h1>
        <p className="text-sm text-muted-foreground">Buat surat keterangan, rekomendasi pinjaman, dll dengan kop koperasi otomatis.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Surat Baru</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Jenis Surat</Label>
                <Select value={type} onValueChange={(v) => setType(v as LetterType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LETTER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anggota</Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger><SelectValue placeholder="Pilih anggota..." /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nama_lengkap} {m.nomor_anggota ? `(${m.nomor_anggota})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nomor Surat</Label>
                <Input value={nomor} onChange={(e) => setNomor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Perihal</Label>
                <Input value={perihal} onChange={(e) => setPerihal(e.target.value)} />
              </div>
            </div>

            {type === "rekomendasi_pinjaman" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label>Nominal Rekomendasi (Rp)</Label>
                  <Input inputMode="numeric" value={extraNominal} onChange={(e) => setExtraNominal(e.target.value.replace(/\D/g, ""))} placeholder="10000000" />
                </div>
                <div className="space-y-2">
                  <Label>Tujuan</Label>
                  <Input value={extraTujuan} onChange={(e) => setExtraTujuan(e.target.value)} placeholder="modal usaha, renovasi, dll" />
                </div>
              </div>
            )}

            {type === "keterangan_usaha" && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label>Nama Usaha</Label>
                  <Input value={extraUsaha} onChange={(e) => setExtraUsaha(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lokasi Usaha</Label>
                  <Input value={extraLokasi} onChange={(e) => setExtraLokasi(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Isi Tambahan / Override (opsional)</Label>
              <Textarea rows={5} value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Kosongkan untuk pakai template otomatis sesuai jenis surat." />
            </div>

            <Button onClick={generate} disabled={busy || !memberId} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generate & Unduh PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Riwayat Surat</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada surat.</p>
            ) : (
              <ul className="space-y-2 text-sm max-h-[500px] overflow-auto">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{h.nomor_surat}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(h.profiles as { nama_lengkap?: string } | null)?.nama_lengkap ?? "-"}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {LETTER_TYPES.find((t) => t.value === h.letter_type)?.label.split(" ").slice(0,2).join(" ") ?? h.letter_type}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(h.created_at).toLocaleString("id-ID")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
