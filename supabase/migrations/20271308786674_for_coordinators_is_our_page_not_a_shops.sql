-- for_coordinators_is_our_page_not_a_shops
-- Created via `pnpm migration:new` (prefix allocated after every existing migration).
--
-- 2026-11-04: `/for-coordinators` becomes a real top-level route (the For
-- Coordinators page), so `for-coordinators` must stop being a word the
-- shop-address mint can hand out. A shop address is IMMUTABLE once minted.
-- Held by tests/db/vendor-business-slug-mint.db.test.ts ("no NEW route word is
-- left uncovered by the database mint") — and this replaces the temporary
-- KNOWN_DB_MINT_GAP entry the page's first draft carried (owner 2026-11-04:
-- "add it").
--
-- 🔑 THE BODY BELOW IS 20271302376604's, WORD FOR WORD, plus the one new word —
-- that file was the last to replace this function (re-checked with
-- `grep -l "FUNCTION public.business_slug_is_reserved" supabase/migrations/*.sql | sort | tail -1`
-- against origin/main on 2026-11-04). Two same-day replacements of this
-- function once silently deleted each other's words: if another migration
-- replaces it before this merges, re-diff first.
--
-- Idempotent: CREATE OR REPLACE of an IMMUTABLE SQL function; no data change.
-- ⚠ Applied ONLY by the pipeline (`supabase db push --include-all`) after
-- merge — never by hand.

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
      -- ⬇ ADDED 2026-09-27. The supplier landing pages — /suppliers,
      -- /suppliers/[event]/[category] and /suppliers/[event]/[category]/[city] —
      -- the pages the locked SEO & AI Discoverability Playbook (2026-05-14, doc
      -- 17 §5.1) planned and nobody built. A shop called "Suppliers" would hold
      -- this word forever and the whole directory could never live here.
      -- Verified in prod first — no shop and no event holds it.
      'suppliers',
      -- ⬇ ADDED 2026-09-30. The supplier sign-up / plans page, moved here from
      -- /vendors (owner, DECISION_LOG 2026-09-29 "LANE 2 §2C" (3)). `vendors`
      -- and `for-vendors` stay reserved above: both still resolve, as 308s to
      -- this page, and a shop holding either would shadow the redirect.
      'for-suppliers',
      -- ⬇ ADDED 2026-10-25. The public "What kind of event are you planning?"
      -- picker the home page's "Start your event — free" opens BEFORE sign-up
      -- (owner, DECISION_LOG 2026-10-25). A shop called "Start" would hold
      -- this word forever and shadow the page. Verified in prod first — no
      -- shop and no event holds it.
      'start',
      -- ⬇ ADDED 2026-11-02 by 20271302376604. The Maria and Jose sample's
      -- signed-out pages (/sample, /sample/hub/[guestKey] …). A shop called
      -- "Sample" would hold this word forever and shadow them. NOT verified
      -- in prod (a builder session reads no production data) — owner check:
      -- select count(*) from vendor_profiles where lower(business_slug)='sample';
      'sample',
      -- ⬇ ADDED 2026-11-04 by 20271308786674. The For Coordinators page
      -- (/for-coordinators, ported from the approved 4 Nov prototype). A shop
      -- called "For Coordinators" would hold this word forever and its address
      -- could never work — the static route always wins the URL. NOT verified in
      -- prod (a builder session reads no production data) — owner check:
      -- select count(*) from vendor_profiles where lower(business_slug)='for-coordinators';
      'for-coordinators',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
