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
 * Thrown when the namespace could not be READ — not when a name is taken.
 *
 * Minting a public web address we could not check is the harm this whole module
 * exists to prevent, so the mint refuses rather than guessing. The event INSERT
 * that follows every call site would be failing at the same moment anyway.
 */
export class SlugNamespaceUnreadableError extends Error {
  constructor() {
    super(
      'We could not check web-address availability just now. Please try creating the event again.',
    );
    this.name = 'SlugNamespaceUnreadableError';
  }
}

/**
 * Generate a unique slug for an event, deriving from display_name and
 * appending a numeric suffix until the slug is unique. Uses admin client to
 * bypass RLS for the uniqueness check (the row may not exist yet).
 *
 * ⚠ ASKS ALL FOUR NAMESPACES, NOT JUST `events`. Weddings, shops and people all
 * live at `setnayan.com/{word}` and a retired word keeps forwarding for 90 days.
 * This function used to ask `events` + the forwarding ledger only, while
 * `app/[slug]/page.tsx` resolves the EVENT first — so an auto-minted wedding
 * name that happened to equal a live shop's address SILENTLY TOOK OVER that
 * shop's public page, one that is in our sitemap.
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
    let candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (candidate.length > 32) {
      const trimmed = base.slice(0, 32 - String(attempt + 1).length - 1);
      candidate = `${trimmed}-${attempt + 1}`;
    }
    const conflict = await findSlugConflict(admin, candidate);
    // A namespace we cannot READ is not a name that is taken. Trying 99 more
    // candidates cannot succeed, and the 100th path below returns a name that
    // was never checked at all.
    if (conflict === 'unverified') throw new SlugNamespaceUnreadableError();
    if (!conflict) return candidate;
  }

  // Pathological fallback — use a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Is this word unavailable for a new event?
 *
 * ⚠ THIS IS THE CREATE PATH, AND IT MUST ASK THE SAME QUESTION THE RENAME PATH
 * ASKS. It used to query `events` and the forwarding ledger only — never
 * `vendor_profiles.business_slug`, never `users.slug` — and it DISCARDED the
 * `error` from its own read, so an unreadable table came back `data: null` and
 * read as "free". Both holes now close in one place: `findSlugConflict`.
 *
 * Fails CLOSED. Any conflict, including `'unverified'`, answers TRUE.
 */
export async function isSlugTaken(
  admin: SupabaseClient,
  slug: string,
  exclusions: SlugExclusions = {},
): Promise<boolean> {
  return (await findSlugConflict(admin, slug, exclusions)) !== null;
}
