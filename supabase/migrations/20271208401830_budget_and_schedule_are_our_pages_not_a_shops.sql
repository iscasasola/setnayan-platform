-- budget_and_schedule_are_our_pages_not_a_shops
--
-- 2026-09-06: the last two free workspace tools get public description pages
-- (owner: *"add these"*), so `budget` and `schedule` become real top-level
-- routes and must stop being words the shop-address mint can hand out.
--
-- WHY THIS IS URGENT RATHER THAN TIDY: a shop address is IMMUTABLE once minted.
-- A business named "Budget" would hold setnayan.com/budget forever and our own
-- page could never live there — the trap that nearly cost /creators and
-- /open-shop on 2026-08-11, and the reason `pay`, `pakanta`, `mood-board`,
-- `web-only` and the first three free tools were each reserved the day their
-- pages landed.
--
-- ⚠ `samahan` IS NOT ADDED HERE — it is ALREADY reserved (2026-08-11, when the
-- `/samahan/join` route folder appeared). Its doorway page ships in the same
-- change, and needed no reservation because the word was already ours.
--
-- Verified in production before writing this, by querying rather than assuming
-- (2026-09-06):
--
--   select s, business_slug_is_reserved(s),
--          (select count(*) from vendor_profiles where lower(business_slug) = s)
--     from unnest(array['budget','schedule','samahan']) s;
--   → budget false/0 · schedule false/0 · samahan TRUE/0
--
-- 🔑 THE BODY BELOW IS `pg_get_functiondef` READ OUT OF PRODUCTION TODAY, not
-- from memory and not from the newest migration file. On 2026-09-05 two
-- same-day migrations each replaced this function without knowing about the
-- other, and the one that applied last silently deleted the other's words —
-- in production that would have UN-RESERVED `web-only`, a word already
-- protecting a live route. Reading the live definition is the only way to be
-- sure the union is complete. If another migration lands between this being
-- written and merged, re-read and re-diff before pushing.

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
      -- ⬇ ADDED 2026-09-05 by 20271205904859. Where the App Store shell lands
      -- when it reaches a paid digital feature it may not show (App Review
      -- 3.1.1 / 3.1.3(b), lib/store-shell.ts).
      'web-only',
      -- ⬇ ADDED 2026-09-05 by 20271205860548, and RE-STATED by 20271206246873
      -- because that file and the one above replaced each other. The three free
      -- planning tools' public pages.
      'marketplace', 'guest-list', 'seat-plan',
      -- ⬇ ADDED 2026-09-06. The last two free workspace tools to get a doorway
      -- (owner: "add these"). `samahan` gained its page in the same change and
      -- is already reserved above, from 2026-08-11.
      'budget', 'schedule',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
