-- mood_board_is_our_page_not_a_shops
--
-- PR #5141 gives the Mood Board a real public page at /mood-board and makes it
-- the ninth Studio product. A top-level route means `mood-board` must stop
-- being a word the shop-address mint can hand out.
--
-- WHY THIS IS URGENT RATHER THAN TIDY: a shop address is IMMUTABLE once minted.
-- A business named "Mood Board" would hold setnayan.com/mood-board forever and
-- our own product page could never live there — the same trap that nearly cost
-- us /creators and /open-shop on 2026-08-11, and the reason `pay` was reserved
-- on 2026-08-21 and `pakanta` on 2026-08-23.
--
-- The app-side list (`lib/reserved-slugs.ts`, generated from the route folders)
-- already carries it — a route folder appeared, so the generator picked it up.
-- This is the DATABASE half, which is the one that decides when a shop
-- registers, and it does NOT regenerate itself.
-- `tests/db/vendor-business-slug-mint.db.test.ts` fails until both agree; that
-- is the check that sent us here, and it was the ONLY thing failing on #5141.
--
-- 🔑 THE TWO HALVES ARE ONE MECHANISM. Having only the TypeScript half is
-- indistinguishable from having neither: the app would refuse the name in its
-- own form while the database still minted it to anyone arriving another way.
--
-- Verified in production before writing this, by querying rather than assuming:
--
--   select business_slug_is_reserved('mood-board'),
--          (select count(*) from vendor_profiles
--             where lower(business_slug) = 'mood-board');
--   → false, 0
--
-- So the mint could have handed it out today, and reserving it takes nothing
-- away from anybody.
--
-- 🔑 THE BODY BELOW IS REPRODUCED FROM `pg_get_functiondef` READ OUT OF
-- PRODUCTION on 2026-09-03, not from memory and not from the newest migration
-- file. CREATE OR REPLACE quietly reverts any fix a reader forgot was in there,
-- so the live definition is the only safe source. It was read, diffed against
-- this text, and the ONLY difference is the 'mood-board' entry added below.

CREATE OR REPLACE FUNCTION public.business_slug_is_reserved(p_slug text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
    SELECT lower(coalesce(p_slug, '')) = ANY (ARRAY[
      -- auth / account / system
      'about', 'admin', 'api', 'auth', 'contact', 'dashboard', 'dpo',
      'forgot-password', 'health', 'help', 'join', 'legal', 'login', 'logout',
      'privacy', 'register', 'reset-password', 'settings', 'signup', 'support',
      'terms',
      -- routing namespaces / prefixes
      'u', 'v', 'vendor', 'vendor-dashboard', 'venue', 'venues',
      -- real top-level product / marketing routes
      'acceptable-use', 'alaala', 'blog', 'cookies', 'download', 'explore',
      'features', 'for-vendors', 'how-it-works', 'monogram', 'our-story', 'pa3d',
      'palogo', 'panood', 'papic', 'patiktok', 'pawebsite', 'pricing',
      'realstories', 'refunds', 'setnayan-ai', 'storytellers', 'tour', 'vendors',
      'waitlist', 'wall', 'why-setnayan',
      -- ⬇ ADDED 2026-08-11. Every one is a REAL top-level page that this
      -- function could previously have handed to a shop. `creators` and
      -- `open-shop` are live and in the sitemap.
      'claim', 'creators', 'demo-capture', 'dev', 'host', 'onboarding',
      'open-shop', 'pabati', 'proposals', 'prototype', 'receipts', 'samahan',
      'site-editor', 'tl', 'vendor-invite',
      -- ⬇ ADDED 2026-08-17. The Live Studio VENUE-SCREEN page, named by the
      -- owner on the day he ruled that a Live Studio screen is a different
      -- product from the Live Photo Wall. Reserved BEFORE the route exists
      -- because a shop address is immutable once minted: a business called
      -- "Live" would hold this word forever and the page could never be built.
      -- Verified in prod first — no event, shop or person holds it.
      'live',
      -- ⬇ ADDED 2026-08-21. The ONE payment page every purchase lands on.
      'pay',
      -- ⬇ ADDED 2026-08-23. Pakanta's own public page, shipped in the same
      -- change that makes Pakanta the eighth Studio product.
      'pakanta',
      -- ⬇ ADDED 2026-09-03. The Mood Board's own public page, shipped in the
      -- same change that makes the Mood Board the ninth Studio product. It is
      -- a FREE tool, which is exactly why it needed a public doorway: the rail
      -- hands a signed-out stranger StudioApp.href verbatim, so an
      -- event-scoped href would have 404'd for the people the rail exists to
      -- introduce.
      'mood-board',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
