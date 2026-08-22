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
//
// ⚠ 2026-08-09 — THE LIST IS NOW TWO HALVES, AND ONLY ONE IS HAND-TYPED.
// A hand-typed list is silent about whatever nobody typed into it: fifteen real
// top-level pages were missing, including /creators and /open-shop, which are
// live and in the sitemap. `ROUTE_RESERVED_SLUGS` below is therefore GENERATED
// from the route folders on disk (scripts/gen-reserved-slugs.mjs), so a page
// added tomorrow is protected the moment its folder exists.
// ============================================================================

/**
 * The hand-authored half. This is the set MIRRORED BY THE DATABASE
 * (`public.business_slug_is_reserved`, migration 20271117527966) and compared
 * mechanically by tests/db/vendor-business-slug-mint.db.test.ts. It holds words
 * that are NOT route folders — namespaces, redirect targets, Next.js internals
 * and defensive entries — so it cannot be derived from disk.
 *
 * Adding a word here means adding it to that migration too.
 */
export const DB_MIRRORED_RESERVED_SLUGS: ReadonlySet<string> = new Set([
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
  'cookies',
  'download',
  'explore',
  'features',
  'for-vendors',
  'how-it-works',
  'monogram',
  'our-story',
  'vendors',
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
  // /storytellers is a redirect into /realstories#storytellers (Storytellers
  // PR-D 2026-07-16) — reserve the word so no event slug can shadow it.
  'storytellers',
  'tour',
  'waitlist',
  'wall',
  'why-setnayan',

  // --- ⬇ ADDED 2026-08-17 -------------------------------------------------
  // The Live Studio VENUE-SCREEN page, named by the owner the same day he ruled
  // that a Live Studio screen is a DIFFERENT product from the Live Photo Wall
  // (see lib/panood-screens.ts). Reserved BEFORE `app/live/` exists, because a
  // shop's address is IMMUTABLE once minted — a business called "Live" would
  // hold setnayan.com/live forever and the page could never be built there.
  // Verified in prod first: no event, shop or person held it.
  // ⚠ It belongs in THIS half, not ROUTE_RESERVED_SLUGS: that half is GENERATED
  // from the route folders on disk, so naming a folder that does not exist yet
  // breaks its drift test. Mirrored by migration 20271147550834.
  'live',

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
 * The GENERATED half — every top-level folder under `apps/web/app` that
 * actually serves a URL and whose name a person could type as a slug.
 *
 * ⛔ DO NOT HAND-EDIT the block between the markers. Run
 * `node scripts/gen-reserved-slugs.mjs` from `apps/web`.
 * `lib/reserved-slugs.test.ts` re-reads the folders and fails if this drifts.
 */
export const ROUTE_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // >>> BEGIN GENERATED ROUTE SLUGS — regenerate with scripts/gen-reserved-slugs.mjs
  'about',
  'acceptable-use',
  'admin',
  'alaala',
  'api',
  'auth',
  'blog',
  'claim',
  'cookies',
  'creators',
  'dashboard',
  'demo-capture',
  'dev',
  'download',
  'explore',
  'features',
  'forgot-password',
  'health',
  'help',
  'host',
  'how-it-works',
  'join',
  'login',
  'monogram',
  'onboarding',
  'open-shop',
  'our-story',
  'pa3d',
  'pabati',
  'pakanta',
  'palogo',
  'panood',
  'papic',
  'patiktok',
  'pawebsite',
  'pay',
  'pricing',
  'privacy',
  'proposals',
  'prototype',
  'realstories',
  'receipts',
  'refunds',
  'reset-password',
  'samahan',
  'setnayan-ai',
  'signup',
  'site-editor',
  'terms',
  'tl',
  'tour',
  'u',
  'v',
  'vendor',
  'vendor-dashboard',
  'vendor-invite',
  'vendors',
  'waitlist',
  'wall',
  'why-setnayan',
  // <<< END GENERATED ROUTE SLUGS
]);

/**
 * What every claim and resolution path actually checks: both halves together.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...DB_MIRRORED_RESERVED_SLUGS,
  ...ROUTE_RESERVED_SLUGS,
]);

/**
 * Case-insensitive reserved-slug check. Slugs are always stored lowercase (the
 * ^[a-z0-9-]{3,32}$ format enforces it), but resolution paths may receive a
 * raw, mixed-case path segment — lowercasing here keeps the guard robust.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
