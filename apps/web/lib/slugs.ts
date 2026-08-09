import type { SupabaseClient } from '@supabase/supabase-js';
import { RESERVED_SLUGS } from './reserved-slugs';
import { isSlugForwarding, type SlugExclusions } from './slug-availability';

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
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (candidate.length > 32) {
      const trimmed = base.slice(0, 32 - String(attempt + 1).length - 1);
      const c2 = `${trimmed}-${attempt + 1}`;
      const taken = await isSlugTaken(admin, c2);
      if (!taken) return c2;
      continue;
    }
    const taken = await isSlugTaken(admin, candidate);
    if (!taken) return candidate;
  }

  // Pathological fallback — use a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Is this word unavailable for a new event?
 *
 * ⚠ A RETIRED ADDRESS IS NOT FREE. Renaming an event leaves a forwarding row
 * live for 90 days (`slug_change_log.redirect_until`), so the old word still
 * carries printed invitations and shared links. Handing it to a new couple
 * lands those guests on a stranger's page — checking `events` alone said the
 * word was free the moment its owner let go of it.
 */
export async function isSlugTaken(
  admin: SupabaseClient,
  slug: string,
  exclusions: SlugExclusions = {},
): Promise<boolean> {
  const lower = slug.toLowerCase();
  const { data } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', lower)
    .maybeSingle();
  if (data) return true;
  return isSlugForwarding(admin, lower, exclusions);
}
