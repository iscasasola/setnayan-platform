/**
 * open-shop-phone.ts — the contact-number box on "Open your shop", as pure rules (owner, the 2026-11-06 gate walk).
 *
 * Owner, verbatim: *"area code on the first side and the number on the right… the first digit should start with a 9
 * and the numbers of digits"*, then *"Let us allow landlines too."* (DECISION_LOG 2026-11-06 "OPEN YOUR SHOP — THE
 * GATE-WALK FIXES"). So the box is:
 *
 *   [ +63 ] [ 917 888 8889 ]
 *    fixed   digits only — starts with 9 → a MOBILE, exactly 10 digits;
 *            anything else → a LANDLINE with its area code (2 for Metro Manila, 32 Cebu, …)
 *
 * 🔑 THIS FILE DOES NOT KNOW THE NUMBERING PLAN. Whether a number is real is `parsePhPhone` (`lib/ph-phone.ts`,
 * through `parseVendorPhone` on the server) — the one place the area codes and the DITO range live. This file only
 * shapes what is typed (strip, cap, space) and says, while typing, how far the box is from a number that rule
 * accepts. A second list of area codes here would be a second truth about one fact.
 *
 * Pure — no React — so `open-shop-phone.test.ts` runs every rule.
 */
import { parsePhPhone } from './ph-phone';

/** The country code the left half shows. Fixed: the map only places shops in the Philippines (`lib/phone-rules.ts`). */
export const PH_PREFIX = '+63';

/** What the right half suggests. A real mobile shape — never a format the box would refuse. */
export const PH_PHONE_PLACEHOLDER = '917 888 8889';

/**
 * Digits only, with what the fixed +63 already says taken off the front: a pasted `+63 917…` or `63917…`, and the
 * domestic trunk 0 (`0917…`, `(02) 8…`). Never longer than the kind of number it is turning into.
 */
export function phoneDigitsFromTyped(raw: string): string {
  let d = (raw ?? '').replace(/\D/g, '');
  // A leading 63 is the country code only when what follows could still be a whole national number —
  // "632 8123 4567" is +63 2…, but a bare "63" typed as the start of a Davao landline ("63 …") is not.
  if (d.startsWith('63') && (raw.trim().startsWith('+') || d.length >= 11)) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d.slice(0, maxDigitsFor(d));
}

/** The longest national number this start can become: a mobile is 10; Manila 2 + 8 = 9; elsewhere area + up to 8. */
export function maxDigitsFor(digits: string): number {
  if (digits.startsWith('9')) return 10;
  if (digits.startsWith('89')) return 10; // DITO 0895–0899 mobiles — still ten, still parsePhPhone's call.
  if (digits.startsWith('2')) return 9;
  return 10;
}

/** Spaced as typed: `917 888 8889` · `2 8123 4567` · `32 123 4567`. */
export function formatPhoneDigits(digits: string): string {
  const d = digits;
  if (!d) return '';
  const group = (s: string, sizes: number[]) => {
    const out: string[] = [];
    let i = 0;
    for (const n of sizes) {
      if (i >= s.length) break;
      out.push(s.slice(i, i + n));
      i += n;
    }
    if (i < s.length) out.push(s.slice(i));
    return out.join(' ');
  };
  // A start no Philippine number has is left as typed — spacing it would dress up a number that cannot be one.
  if (/^[01]/.test(d)) return d;
  if (d.startsWith('9') || d.startsWith('89')) return group(d, [3, 3, 4]);
  if (d.startsWith('2')) return group(d, [1, 4, 4]);
  return group(d, [2, 3, 4]);
}

export type PhoneBoxState =
  /** Nothing typed. */
  | { state: 'empty' }
  /** A number `parsePhPhone` accepts. `e164` is what is saved. */
  | { state: 'ok'; kind: 'mobile' | 'landline'; e164: string }
  /** Still being typed — a quiet hint, not an error. */
  | { state: 'typing'; message: string }
  /** Cannot become a Philippine number — said under the box, in red, while typing. */
  | { state: 'error'; message: string };

/** The sentences under the box. One place, so the test reads the same words the screen shows. */
export const PHONE_BOX_COPY = {
  badStart: 'A mobile starts with 9. A landline starts with its area code — 2 for Metro Manila.',
  mobileShort: (left: number) => `A mobile has 10 digits after +63 — ${left} more.`,
  landlineShort: 'Add the rest of the landline — area code, then the number.',
  notPh: 'That is not a Philippine number. Check the area code, or type a mobile starting with 9.',
} as const;

/**
 * Where the box is, from the digits on the right. `finished` = the person has left the box (blur) or pressed
 * Continue: then an unfinished number is an error, not a hint.
 */
export function phoneBoxState(digits: string, finished = false): PhoneBoxState {
  const d = digits.replace(/\D/g, '');
  if (!d) return { state: 'empty' };
  const parsed = parsePhPhone(`${PH_PREFIX}${d}`);
  if (parsed.ok) return { state: 'ok', kind: parsed.kind, e164: parsed.e164 };
  // No Philippine number begins with 1 (and a 0 was already stripped as the trunk prefix).
  if (/^[01]/.test(d)) return { state: 'error', message: PHONE_BOX_COPY.badStart };
  if (d.startsWith('9')) {
    const left = 10 - d.length;
    return finished
      ? { state: 'error', message: PHONE_BOX_COPY.mobileShort(left) }
      : { state: 'typing', message: PHONE_BOX_COPY.mobileShort(left) };
  }
  // A landline: it is still "typing" only while SOME completion of it is a number `parsePhPhone` accepts — asked of
  // that rule by padding, never of a second area-code list here. So an unassigned area code ("41…") is said at once.
  if (d.length < maxDigitsFor(d) && canStillBecomeANumber(d)) {
    return finished
      ? { state: 'error', message: PHONE_BOX_COPY.landlineShort }
      : { state: 'typing', message: PHONE_BOX_COPY.landlineShort };
  }
  return { state: 'error', message: PHONE_BOX_COPY.notPh };
}

/** Could more digits after these still make a number `parsePhPhone` accepts? (Pads with a neutral digit.) */
function canStillBecomeANumber(d: string): boolean {
  for (let len = d.length + 1; len <= maxDigitsFor(d); len++) {
    if (parsePhPhone(`${PH_PREFIX}${d.padEnd(len, '5')}`).ok) return true;
  }
  return false;
}

/** The value the form posts: E.164 when it is a number, else what was typed behind +63 (the server refuses it). */
export function phonePostValue(digits: string): string {
  const s = phoneBoxState(digits);
  if (s.state === 'ok') return s.e164;
  return digits ? `${PH_PREFIX}${digits}` : '';
}
