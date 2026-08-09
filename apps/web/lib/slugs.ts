import type { SupabaseClient } from '@supabase/supabase-js';
import { RESERVED_SLUGS } from './reserved-slugs';
import { findSlugConflict, type SlugExclusions } from './slug-availability';

const SLUG_PATTERN = /^[a-z0-9-]{3,32}$/;

export function isValidSlug(slug: string): boolean {
  if (!SLUG_PATTERN.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')          // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')               // any non-alphanumeric → hyphen
    .replace(/-+/g, '-')                       // collapse multiple hyphens
    .replace(/^-|-$/g, '')                     // trim leading/trailing hyphens
    .slice(0, 32);
}

/**
 * Generate a unique slug for an event, deriving from display_name and
 * appending a numeric suffix until the slug is unique. Uses admin client to
 * bypass RLS for the uniqueness check (the row may not exist yet).
 */
export async function generateUniqueSlug(
  admin: SupabaseClient,
  baseLabel: string,
): Promise<string> {
  let base = slugify(baseLabel);
  if (base.length < 3) base = `wedding-${Math.random().toString(36).slice(2, 7)}`;
  if (RESERVED_SLUGS.has(base)) base = `${base}-wedding`;

  // Truncate so we always have room for a "-99" suffix.
  if (base.length > 28) base = base.slice(0, 28).replace(/-+$/, '');

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const raw = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const candidate =
      raw.length > 32
        ? `${base.slice(0, 32 - String(attempt + 1).length - 1)}-${attempt + 1}`
        : raw;

    const conflict = await findSlugConflict(admin, candidate);
    if (conflict === null) return candidate;

    // 🩹 AN UNREADABLE NAMESPACE IS NOT A TAKEN WORD, AND IT MUST NOT LOOP.
    // Every probe fails closed, so one broken read makes all 100 candidates
    // look taken — 400 queries, then the unchecked fallback below anyway. Bail
    // straight to a high-entropy address instead.
    //
    // ⚠ AND IT MUST NOT THROW. A previous attempt raised here; nothing catches
    // it. All five callers (`create-event/actions.ts` ×2, `onboarding/wedding`,
    // `onboarding/simple`, `onboarding/_shared/commit-event`) do a bare `await`,
    // two of them returning `{ok:false,error}` their wizard renders and three
    // redirecting with `?error=`. A throw bypasses both, and Next redacts the
    // message in production — so a failed read of any of three unrelated tables
    // would have crashed the entire event-creation funnel where it used to
    // degrade. A couple with an ugly address can rename; a couple who cannot
    // create their wedding at all has nowhere to go.
    if (conflict === 'unverified') break;
  }

  // Pathological fallback: 10 random base-36 characters (~3.6 × 10¹⁵) rather
  // than 6, because this value is NOT checked against anything.
  return `${base.slice(0, 20).replace(/-+$/, '')}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Is this word unavailable for a new event?
 *
 * 🔑 ONE ANSWER, FOUR NAMESPACES. Weddings, shops and people all live at
 * `setnayan.com/{word}`, and a retired word keeps forwarding for 90 days. This
 * used to ask TWO of the four — `events` and the forwarding ledger — while
 * `findSlugConflict` right beside it asked all four. So the CREATE path could
 * auto-mint a new wedding onto a LIVE SHOP'S ADDRESS, and because
 * `app/[slug]/page.tsx` resolves the event first and only then falls through to
 * the vendor renderer, that wedding silently took over the shop's public page —
 * a page that is in our sitemap.
 *
 * ⚠ IT ALSO DISCARDED `error`. Supabase resolves `{ error }` rather than
 * throwing, so a failed read of `events` returned `data: null` and the word
 * read as FREE — the one direction that hands out an address somebody owns.
 * `findSlugConflict` fails closed on every probe.
 */
export async function isSlugTaken(
  admin: SupabaseClient,
  slug: string,
  exclusions: SlugExclusions = {},
): Promise<boolean> {
  return (await findSlugConflict(admin, slug, exclusions)) !== null;
}
