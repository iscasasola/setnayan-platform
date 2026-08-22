-- pakanta_is_our_page_not_a_shops
--
-- This change gives Pakanta a real public page at /pakanta and makes it the
-- eighth Studio product. A top-level route means `pakanta` must stop being a
-- word the shop-address mint can hand out.
--
-- WHY THIS IS URGENT RATHER THAN TIDY: a shop address is IMMUTABLE once minted.
-- A business named "Pakanta" would hold setnayan.com/pakanta forever and our
-- own product page could never live there — the same trap that nearly cost us
-- /creators and /open-shop on 2026-08-11, and the reason `pay` was reserved on
-- 2026-08-21.
--
-- The app-side list (`lib/reserved-slugs.ts`, generated from the route folders)
-- already carries it — a route folder appeared, so the generator picked it up.
-- This is the DATABASE half, which is the one that decides when a shop
-- registers, and it does NOT regenerate itself.
-- `tests/db/vendor-business-slug-mint.db.test.ts` fails until both agree; that
-- is the check that sent us here, and it was the only thing failing on this PR.
--
-- Verified in production before writing this, by querying rather than assuming:
-- no shop and no event holds `pakanta`, and `business_slug_is_reserved('pakanta')`
-- returned NO — so the mint could have handed it out today, and nothing is being
-- taken away from anybody by reserving it.
--
-- 🔑 THE BODY BELOW IS REPRODUCED FROM `pg_get_functiondef` READ OUT OF
-- PRODUCTION, not from memory and not from the newest migration file — they
-- happened to agree, and that was CHECKED rather than assumed. CREATE OR REPLACE
-- quietly reverts any fix a reader forgot was in there.

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
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;

COMMENT ON FUNCTION public.business_slug_is_reserved(text) IS
  'Words a shop address may never take, because they are our own pages. Kept in '
  'lockstep with lib/reserved-slugs.ts (generated from the route folders) by '
  'tests/db/vendor-business-slug-mint.db.test.ts. A shop address is immutable, '
  'so a missing word here is permanent.';
