/**
 * Is this a real Philippine contact number?
 *
 * Owner 2026-08-10: *"contact number should also be a legitimate number from
 * the location of their shop. so if the mapped in USA, the number should be USA
 * correct. there are rules for what contact numbers are for each country. This
 * also means the contact number is reliant to the map location."*
 *
 * ── THE DEPENDENCY IS REAL. THE COUNTRY CHOICE IS NOT — YET. ────────────────
 * A number's validity genuinely depends on its country, so the rule is right.
 * But `lib/geo.ts` sets `countrycodes=ph` on BOTH the address search and the
 * pin lookup, so a vendor cannot pin an address outside the Philippines at all.
 * There is exactly one country to check against today.
 *
 * So this validates the Philippines properly instead of half-building a country
 * matrix for a case the map cannot produce. 🔑 **When a second country opens,
 * this file is where it lands — and that is also the moment the steps must be
 * reordered so the pin comes BEFORE the number**, because only then does the
 * country stop being knowable in advance.
 *
 * ── WHAT IT ACCEPTS, AND WHY IT IS DELIBERATELY GENEROUS ────────────────────
 * The cost of being too strict is refusing a real business its own phone
 * number, on the screen where it is trying to sign up, with no way around it.
 * The cost of being too loose is a bad number reaching a couple. The first is
 * worse and irreversible at that moment, so this accepts every way a Filipino
 * writes their own number and rejects only what cannot be one:
 *
 *   MOBILE     09XX XXX XXXX · +639XX XXX XXXX · 639XXXXXXXXX · 9XXXXXXXXX
 *   LANDLINE   (02) 8XXX XXXX · 02-8XXXXXXX · +63 2 8XXX XXXX · 032 XXX XXXX
 *
 * Spaces, hyphens, brackets and dots are all noise and are stripped first.
 */

export type PhPhone =
  | { ok: true; e164: string; display: string; kind: 'mobile' | 'landline' }
  | { ok: false; reason: 'empty' | 'not_ph' };

/** Digits only, and a leading + kept as a marker. */
function strip(raw: string): { plus: boolean; digits: string } {
  const trimmed = raw.trim();
  return { plus: trimmed.startsWith('+'), digits: trimmed.replace(/\D/g, '') };
}

/**
 * Reduce any accepted spelling to the national significant number — what
 * follows the country code, with no trunk zero.
 */
function toNational(raw: string): string | null {
  const { plus, digits } = strip(raw);
  if (!digits) return null;

  // ── AN EXPLICIT + THAT IS NOT OURS IS FOREIGN, FULL STOP ─────────────────
  // 🔑 THIS WAS A REAL HOLE. Without it, `+65 6123 4567` (Singapore) lost its
  // plus, became the bare digits `6561234567`, and matched the landline shape —
  // ten digits starting with 6 — so a foreign number was accepted as a local
  // one. A leading + is the caller stating their country code out loud; when
  // they say a country that is not the Philippines, no amount of pattern
  // matching on what follows should second-guess them.
  if (plus && !digits.startsWith('63')) return null;

  // +63… / 63… — a leading 63 is only a country code when what follows is a
  // plausible national number. `632…` as a bare local string would otherwise be
  // read as country code + "2…", which is why the length is checked too.
  if (digits.startsWith('63') && (plus || digits.length >= 12)) {
    const rest = digits.slice(2);
    return rest.replace(/^0+/, '') || null;
  }
  // A leading 0 is the domestic trunk prefix, not part of the number.
  if (digits.startsWith('0')) return digits.replace(/^0+/, '') || null;
  return digits;
}

/**
 * Philippine mobile: 10 digits beginning with 9.
 * Landline: an area code (1–4 digits) plus a 6–8 digit subscriber number,
 * which across the country totals 8–10 digits and never starts with 9.
 */
export function parsePhPhone(raw: string): PhPhone {
  if (!raw || !raw.trim()) return { ok: false, reason: 'empty' };
  const n = toNational(raw);
  // `null` here means "there were digits, but they cannot be Philippine" —
  // NOT that the box was blank. Reporting that as 'empty' would tell someone
  // who typed a full foreign number that they had left the field alone.
  if (!n) return { ok: false, reason: strip(raw).digits ? 'not_ph' : 'empty' };

  if (/^9\d{9}$/.test(n)) {
    return {
      ok: true,
      kind: 'mobile',
      e164: `+63${n}`,
      display: `+63 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`,
    };
  }
  if (/^[2-8]\d{7,9}$/.test(n)) {
    return { ok: true, kind: 'landline', e164: `+63${n}`, display: `+63 ${n}` };
  }
  return { ok: false, reason: 'not_ph' };
}

/** True when this is a usable Philippine number. */
export function isPhPhone(raw: string): boolean {
  return parsePhPhone(raw).ok;
}
