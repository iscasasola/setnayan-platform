// Philippine dial helpers — pure, shared by lib/booked-handoff.ts, lib/guest-call-links.ts and the read-only
// display of an older meeting's number in lib/virtual-meeting.ts.

/**
 * A Philippine number → E.164 (+63…). Mobile `0917 123 4567` / `917…` /
 * `+63 917…` / `63917…`; landline `0` + area code + number (`02 8123 4567`).
 * Anything else → null.
 */
export function phPhoneToE164(raw: string): string | null {
  const t = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(t)) return null;
  const digits = t.replace(/\D/g, '');
  let national: string | null = null;
  if (t.startsWith('+')) {
    if (!digits.startsWith('63')) return null;
    national = digits.slice(2);
  } else if (digits.startsWith('63') && digits.length === 12) {
    national = digits.slice(2);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else if (digits.startsWith('9') && digits.length === 10) {
    national = digits;
  }
  if (!national) return null;
  const mobile = /^9\d{9}$/.test(national);
  const landline = /^[2-8]\d{7,9}$/.test(national);
  return mobile || landline ? `+63${national}` : null;
}

/** +639171234567 → "0917 123 4567"; a landline → "0" + its national digits. */
export function formatPhPhone(e164: string): string {
  const n = e164.replace(/^\+63/, '');
  if (/^9\d{9}$/.test(n)) return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  return `0${n}`;
}
