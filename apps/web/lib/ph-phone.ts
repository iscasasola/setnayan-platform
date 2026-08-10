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

/**
 * Every area code the Philippine numbering plan actually assigns.
 *
 * 🔴 AN OMISSION HERE REFUSES A REAL BUSINESS ITS OWN LANDLINE, on the screen
 * where it is signing up, with no way around it — and they will not tell us,
 * they will just leave. That is the cost of checking area codes at all, and it
 * is why this list is the whole plan rather than the regions we thought of.
 * If a new one is ever assigned, adding it here is the entire fix.
 *
 * Metro Manila is the single-digit 2; everything else is two digits. No
 * assigned area code begins with 1 or 9 — 9 is mobile, which is what makes the
 * two kinds separable at all.
 */
const AREA_CODES = new Set([
  '2', // Metro Manila
  // Luzon
  '42', '43', '44', '45', '46', '47', '48', '49',
  '52', '54', '55', '56',
  '72', '74', '75', '77', '78',
  // Visayas
  '32', '33', '34', '35', '36', '38', '53',
  // Mindanao
  '62', '63', '64', '65', '68',
  '82', '83', '84', '85', '86', '87', '88',
]);

/**
 * Split a landline national number into its area code and subscriber part.
 * Two-digit codes are tried first: `32…` is Cebu, not Metro Manila's `2`
 * followed by a stray digit.
 */
function splitLandline(n: string): { area: string; subscriber: string } | null {
  for (const len of [2, 1]) {
    const area = n.slice(0, len);
    if (!AREA_CODES.has(area)) continue;
    const subscriber = n.slice(len);
    // 🔑 METRO MANILA IS EXACTLY EIGHT, and that is a real rule rather than a
    // range: the 2019 migration moved the whole city from 7 digits to 8. A
    // seven-digit Manila number is a number somebody has not finished updating,
    // and accepting it stores a line that no longer rings.
    //
    // Provincial exchanges are left at 6–8 deliberately. They vary, the
    // published lists disagree at the edges, and being wrong there refuses a
    // real business its own number — which is the one failure worth avoiding
    // more than the one it prevents.
    const ok = area === '2' ? /^\d{8}$/.test(subscriber) : /^\d{6,8}$/.test(subscriber);
    if (ok) return { area, subscriber };
  }
  return null;
}

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

  // ── MOBILE: ten digits, starting 9 — or DITO's 895–899 ────────────────────
  // 🔑 THE DITO RANGE IS NOT A DETAIL. `0895`–`0899` are real Philippine mobile
  // numbers, and the earlier rule (`^9\d{9}$`) sent every one of them to the
  // landline branch instead — where they were ACCEPTED, so nothing looked
  // wrong, but recorded as the wrong KIND. A value that is quietly mislabelled
  // is worse than one that is refused: nothing ever reports it.
  if (/^9\d{9}$/.test(n) || /^89[5-9]\d{7}$/.test(n)) {
    return {
      ok: true,
      kind: 'mobile',
      e164: `+63${n}`,
      display: `+63 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`,
    };
  }

  // ── LANDLINE: a REAL area code plus a subscriber number ───────────────────
  // The earlier rule accepted any 8–10 digits starting 2–8, so `21234567` — an
  // area code that does not exist — passed as a landline. "Obey the numbering
  // plan" means checking against the plan, not against its shape.
  const landline = splitLandline(n);
  if (landline) {
    return {
      ok: true,
      kind: 'landline',
      e164: `+63${n}`,
      display: `+63 ${landline.area} ${landline.subscriber}`,
    };
  }

  return { ok: false, reason: 'not_ph' };
}

/** True when this is a usable Philippine number. */
export function isPhPhone(raw: string): boolean {
  return parsePhPhone(raw).ok;
}
