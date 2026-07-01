// ============================================================================
// Canonical reserved-slug list — the SINGLE source of truth for words that may
// NOT be used as a public slug (event, user, or vendor) and must never be
// resolved as one.
//
// Consolidates three lists that had independently drifted:
//   - RESERVED_SLUGS       (was in lib/slugs.ts        — event slug CREATION)
//   - RESERVED_TOP_LEVEL   (was in app/[slug]/page.tsx — event RESOLUTION)
//   - RESERVED_TOP_LEVEL   (was in app/[slug]/hub/page.tsx — hub RESOLUTION)
//
// Why one list now: the three-tier routing change puts vendors at the bare root
// (setnayan.com/[vendor-slug]) and users at /u/[user-slug] — so every entity
// type now competes for the same top-level namespace. A word reserved for one
// must be reserved for all, or a slug could shadow (or be shadowed by) a real
// route. Verified 2026-07-01 against prod: ZERO existing event/vendor slugs
// collide with this set, so consolidating is safe for live data.
// ============================================================================

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // --- auth / account / system ---------------------------------------------
  'admin',
  'api',
  'auth',
  'dashboard',
  'health',
  'help',
  'join',
  'legal',
  'login',
  'logout',
  'register',
  'settings',
  'signup',
  'support',
  'terms',
  'privacy',
  'about',
  'contact',
  'dpo',
  'forgot-password',
  'reset-password',

  // --- routing namespaces / prefixes ---------------------------------------
  'u', // NEW — user public-profile namespace (/u/[slug])
  'v', // vendor legacy prefix — kept as a permanent redirect route
  'vendor',
  'vendor-dashboard',
  'venue',
  'venues',

  // --- real top-level product / marketing routes (must not be shadowed) -----
  'acceptable-use',
  'alaala',
  'blog',
  'camera-move-preview',
  'cookies',
  'download',
  'explore',
  'features',
  'for-vendors',
  'how-it-works',
  'monogram',
  'our-story',
  'pa3d',
  'palogo',
  'panood',
  'papic',
  'patiktok',
  'pawebsite',
  'pricing',
  'realstories',
  'refunds',
  'setnayan-ai',
  'tour',
  'waitlist',
  'wall',
  'why-setnayan',

  // --- Next.js internals / special files (defense-in-depth; can't be slugs
  //     anyway per the ^[a-z0-9-]{3,32}$ format, but reserved for safety) -----
  '_next',
  'static',
  'public',
  'manifest.json',
  'sw.js',
  'icon-192.svg',
  'icon-512.svg',
]);

/**
 * Case-insensitive reserved-slug check. Slugs are always stored lowercase (the
 * ^[a-z0-9-]{3,32}$ format enforces it), but resolution paths may receive a
 * raw, mixed-case path segment — lowercasing here keeps the guard robust.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
