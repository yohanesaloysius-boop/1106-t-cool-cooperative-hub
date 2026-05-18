// Indonesia-first phone normalization utilities.
// Accepts: 0812xxxx, 62812xxxx, +62812xxxx, with spaces / dashes.
// Output: E.164 international format, e.g. "+62812xxxx".

export function normalizePhoneId(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (!digits.startsWith("62")) {
    if (digits.startsWith("8")) digits = "62" + digits;
  }
  return "+" + digits;
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
  // +62 + 8xxxxxxxx (8-13 digits after country code)
  return /^\+628\d{7,12}$/.test(n);
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "-";
  const n = normalizePhoneId(raw) ?? raw;
  // +62 812-3456-7890
  const m = n.match(/^\+62(\d{2,3})(\d{3,4})(\d{3,5})$/);
  if (!m) return n;
  return `+62 ${m[1]}-${m[2]}-${m[3]}`;
}
