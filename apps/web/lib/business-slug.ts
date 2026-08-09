/**
 * Business name → shop web address, in TypeScript.
 *
 * Owner 2026-08-09: *"Shop name will be their slug as well. This means you will
 * show what their website address would look like."*
 *
 * ⚠⚠ THIS IS A MIRROR OF SQL, AND A MIRROR THAT DRIFTS IS WORSE THAN NO MIRROR.
 * The address a shop actually gets is minted by a database trigger
 * (`public.slugify_business_name` → `generate_business_slug_for_vendor`,
 * migration `20271117527966`). This function exists ONLY so the wizard can show
 * that address while the vendor types, before any row is written.
 *
 * If the two ever disagree, the preview becomes a promise the product does not
 * keep — the vendor reads one address on screen and is issued a different one,
 * with nothing anywhere reporting a problem. That is the "two hand-typed things
 * are not a guard" failure this codebase has been bitten by repeatedly.
 *
 * 🛡 So they are compared MECHANICALLY, not by eye:
 * `tests/db/business-slug-mirror.db.test.ts` runs BOTH implementations over the
 * same corpus of names — including the awkward ones (ampersands, accents,
 * apostrophes, emoji, pure punctuation, non-Latin script, 40-char names) — and
 * fails on the first disagreement. Change one side and CI shows you the other.
 *
 * The SQL, for reference (migration `20271123576947`):
 *   NULLIF(regexp_replace(
 *     replace(translate(lower(name), <accents>, <plain>), '&', ' and '),
 *     '[^a-z0-9]+', '', 'g'), '')
 *
 * ⚠ SEPARATORS ARE DROPPED, NOT HYPHENATED (owner 2026-08-09: "remove spaces
 * for the slug"). "Banawe Florals" → `banaweflorals`. Addresses minted BEFORE
 * that ruling keep their hyphens forever — the generator never reissues one —
 * so a hyphenated slug in the wild is correct history, not drift.
 */

/** Exactly the pairs `slugify_business_name` passes to `translate()`. */
const ACCENTS = 'áàâäãåéèêëíìîïóòôöõúùûüýñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÝÑÇ';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuuyncaaaaaaeeeeiiiiooooouuuuync';

/** The DB's ceiling — `clip_business_slug(base, 32)`, and `VENDOR_SLUG_RE`'s max. */
export const BUSINESS_SLUG_MAX = 32;
/** Below this the generator borrows from the public id instead (see below). */
export const BUSINESS_SLUG_MIN = 3;

function translateAccents(input: string): string {
  let out = '';
  for (const ch of input) {
    const i = ACCENTS.indexOf(ch);
    out += i === -1 ? ch : (PLAIN[i] ?? ch);
  }
  return out;
}

/** Trim leading and trailing hyphens — Postgres `trim(BOTH '-' FROM …)`. */
function trimHyphens(input: string): string {
  return input.replace(/^-+/, '').replace(/-+$/, '');
}

/**
 * The slug base for a business name, or null when nothing survives (a name that
 * is entirely punctuation, emoji, or non-Latin script). Mirrors
 * `slugify_business_name` — NULL and '' both come back as null.
 */
export function slugifyBusinessName(name: string | null | undefined): string | null {
  const lowered = (name ?? '').toLowerCase();
  const translated = translateAccents(lowered);
  // '&' becomes the WORD "and" BEFORE separators are stripped, so it survives
  // instead of being eaten as punctuation: "Bloom & Vine" → `bloomandvine`,
  // not `bloomvine`. Order is the fragile part of this mirror, not the
  // character set — strip first and the ampersand is silently lost.
  const ampersands = translated.split('&').join(' and ');
  // DROPPED, not collapsed to '-'. With nothing left to trim there is no
  // edge-hyphen case, which is why no trim follows.
  const stripped = ampersands.replace(/[^a-z0-9]+/g, '');
  return stripped.length === 0 ? null : stripped;
}

/** Mirrors `clip_business_slug(base, max)` — clip, then re-trim hyphens. */
export function clipBusinessSlug(base: string | null, max = BUSINESS_SLUG_MAX): string | null {
  const clipped = trimHyphens((base ?? '').slice(0, Math.max(max, 0)));
  return clipped.length === 0 ? null : clipped;
}

export type AddressPreview =
  | { kind: 'empty' }
  /** Fewer than 3 usable characters — the generator falls back to an opaque id. */
  | { kind: 'too_short'; slug: string | null }
  | { kind: 'ok'; slug: string };

/**
 * What the vendor's address will look like, for the live preview.
 *
 * 🔑 `too_short` is NOT an error state to scold with. The database handles it —
 * a 1–2 character name borrows four characters of the shop's public id, and a
 * name with nothing Latin in it falls back to the id entirely. But that id does
 * not exist until the row does, so the wizard genuinely CANNOT show the final
 * address in that case. Saying "we'll pick one for you" is the honest answer;
 * inventing a preview would be a lie, and blocking the name would refuse a
 * legitimate business name ("Yo", "88").
 */
export function previewShopAddress(name: string | null | undefined): AddressPreview {
  const base = clipBusinessSlug(slugifyBusinessName(name));
  if (!name || name.trim().length === 0) return { kind: 'empty' };
  if (!base || base.length < BUSINESS_SLUG_MIN) return { kind: 'too_short', slug: base };
  return { kind: 'ok', slug: base };
}
