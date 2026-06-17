// Indonesia-first phone normalization utilities.
// Accepts: 0812xxxx, 62812xxxx, +62812xxxx, with spaces / dashes.
// Output (canonical storage & display): local format, e.g. "0812xxxx".

export function normalizePhoneId(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Convert any 62.../+62... to local 0... format
  if (digits.startsWith("62")) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("8")) {
    // user typed 812... -> assume Indonesia local
    digits = "0" + digits;
  } else if (!digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits;
}

export function isPhoneLike(input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  if (t.includes("@")) return false;
  // mostly digits / + / - / space
  return /^[+\d][\d\s\-+]{6,}$/.test(t);
}

export function isValidIndonesianPhone(raw: string): boolean {
  const n = normalizePhoneId(raw);
  if (!n) return false;
  // 08xxxxxxxx (local format)
  return /^08\d{7,12}$/.test(n);
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "-";
  const n = normalizePhoneId(raw) ?? raw;
  // 0812-3456-7890
  const m = n.match(/^0(\d{2,3})(\d{3,4})(\d{3,5})$/);
  if (!m) return n;
  return `0${m[1]}-${m[2]}-${m[3]}`;
}
