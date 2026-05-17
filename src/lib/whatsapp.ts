// Utility WhatsApp: normalisasi nomor + buka chat (app / web fallback).
// Format nomor Indonesia: 08xxx -> 628xxx, +62xxx -> 62xxx, dst.

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^0-9+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (s.startsWith("8")) s = "62" + s;
  if (!/^\d{8,15}$/.test(s)) return null;
  return s;
}

export function waUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(rawPhone?: string | null, text = ""): boolean {
  const p = normalizePhone(rawPhone);
  if (!p) return false;
  window.open(waUrl(p, text), "_blank", "noopener,noreferrer");
  return true;
}

export const WA_TEMPLATES: { id: string; label: string; build: (nama: string) => string }[] = [
  {
    id: "salam",
    label: "Salam & Sapa",
    build: (n) => `Halo ${n}, salam sehat dari pengurus Koperasi T-COOL 🌿`,
  },
  {
    id: "welcome",
    label: "Selamat Datang Anggota Baru",
    build: (n) =>
      `Halo ${n}, selamat bergabung di Koperasi T-COOL! Akun Anda sudah aktif. Silakan login & lengkapi profil ya 🙏`,
  },
  {
    id: "angsuran",
    label: "Pengingat Angsuran",
    build: (n) =>
      `Halo ${n}, mengingatkan jatuh tempo angsuran pinjaman Anda di Koperasi T-COOL. Mohon segera diselesaikan. Terima kasih 🙏`,
  },
  {
    id: "rapat",
    label: "Undangan Rapat",
    build: (n) =>
      `Halo ${n}, mengundang Anda untuk hadir pada rapat anggota Koperasi T-COOL. Detail jadwal akan menyusul. Mohon konfirmasi kehadiran 🙏`,
  },
  {
    id: "simpanan",
    label: "Pengingat Simpanan Wajib",
    build: (n) =>
      `Halo ${n}, mengingatkan setoran simpanan wajib bulan ini di Koperasi T-COOL. Terima kasih atas partisipasinya 🌱`,
  },
];
