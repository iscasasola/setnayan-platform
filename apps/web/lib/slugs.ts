import type { SupabaseClient } from '@supabase/supabase-js';

const SLUG_PATTERN = /^[a-z0-9-]{3,32}$/;
const RESERVED_SLUGS = new Set([
  'admin',
  'vendor',
  'v',
  'dashboard',
  'api',
  'register',
  'login',
  'signup',
  'settings',
  'dpo',
  'legal',
  'privacy',
  'support',
  'terms',
  'about',
  'help',
  'contact',
  'join',
  'auth',
  'health',
  'manifest.json',
  'sw.js',
  'icon-192.svg',
  'icon-512.svg',
  '_next',
  'static',
  'public',
]);

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

export async function isSlugTaken(admin: SupabaseClient, slug: string): Promise<boolean> {
  const lower = slug.toLowerCase();
  const { data } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', lower)
    .maybeSingle();
  return !!data;
}
