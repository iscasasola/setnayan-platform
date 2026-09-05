-- marketplace_guest_list_and_seat_plan_are_our_pages_not_a_shops
--
-- 2026-09-05: the three free planning tools get public description pages and
-- join the Studio rail (owner: *"Also add the other services. Marketplace to
-- search for vendors with compare, Guestlist, Seatplan"*). Three new top-level
-- routes — /marketplace · /guest-list · /seat-plan — mean three words the
-- shop-address mint must stop handing out.
--
-- WHY THIS IS URGENT RATHER THAN TIDY: a shop address is IMMUTABLE once minted.
-- A business named "Marketplace" would hold setnayan.com/marketplace forever and
-- our own page could never live there — the trap that nearly cost /creators and
-- /open-shop on 2026-08-11, and the reason `pay`, `pakanta` and `mood-board`
-- were each reserved the day their pages landed.
--
-- The app-side list (`lib/reserved-slugs.ts`, generated from the route folders)
-- picks the three up by itself. This is the DATABASE half, which is the one
-- that decides when a shop registers, and it does NOT regenerate itself.
-- `tests/db/vendor-business-slug-mint.db.test.ts` fails until both agree.
--
-- 🔑 THE TWO HALVES ARE ONE MECHANISM. Having only the TypeScript half is
-- indistinguishable from having neither.
--
-- Verified in production before writing this, by querying rather than assuming
-- (2026-09-05):
--
--   select s, business_slug_is_reserved(s),
--          (select count(*) from vendor_profiles where lower(business_slug) = s)
--     from unnest(array['marketplace','guest-list','seat-plan']) s;
--   → false, 0 — for all three.
--
-- So the mint could have handed any of them out today, and reserving them takes
-- nothing away from anybody.
--
-- 🔑 THE BODY BELOW IS REPRODUCED FROM `pg_get_functiondef` READ OUT OF
-- PRODUCTION on 2026-09-05, not from memory and not from the newest migration
-- file. CREATE OR REPLACE quietly reverts any fix a reader forgot was in there,
-- so the live definition is the only safe source. It was read, diffed against
-- this text, and the ONLY difference is the three entries added below.

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
      -- ⬇ ADDED 2026-09-05. The other three free tools' public pages, shipped
      -- in the same change that makes them the tenth to twelfth Studio rows.
      -- Same reason as the Mood Board: a stranger is handed the href verbatim.
      'marketplace', 'guest-list', 'seat-plan',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
