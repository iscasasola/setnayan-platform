-- monogram_is_500_and_the_reserved_words_are_the_union
--
-- TWO FIXES, both found by CI rather than by reading, and both recorded here
-- because each is a lesson the next person will otherwise re-learn.
--
-- ══ 1 · THE RESERVED-WORD LIST IS A `CREATE OR REPLACE` COLLISION ══════════
--
-- `20271205860548` (this branch) added 'marketplace', 'guest-list', 'seat-plan'.
-- `20271205904859` (merged to main the same day) added 'web-only'. NEITHER
-- knows about the other, and both REPLACE the whole function — so whichever
-- applies LAST silently deletes the other's words.
--
-- 🔑 AND THE TWO ORDERINGS FAIL DIFFERENTLY, WHICH IS WHY THE TEST CAUGHT ONE
-- AND PRODUCTION WOULD HAVE SUFFERED THE OTHER:
--   · The PGlite replay applies in FILENAME order: …860548 then …904859, so
--     'web-only' wins and this branch's three words vanish. That is the failure
--     `vendor-business-slug-mint.db.test.ts` reported.
--   · PRODUCTION is the mirror image and worse. …904859 is ALREADY applied
--     there; `supabase db push --include-all` would then apply …860548 after
--     it, and the older file's body — which has no 'web-only' — would
--     UN-RESERVE a word that is already protecting a live route. A shop could
--     then mint `web-only` and hold setnayan.com/web-only forever.
--
-- ⚠ SO THE EARLIER FILE IS NOT EDITED AND NOT DELETED (migrations are
-- append-only here, and `lint-migrations-never-deleted` enforces it). This one
-- supersedes both by carrying the UNION, and its body is `pg_get_functiondef`
-- READ OUT OF PRODUCTION on 2026-09-05 — after …904859 had landed there — with
-- only this branch's three words added. The live definition is the only safe
-- base: CREATE OR REPLACE quietly reverts anything a reader forgot was in
-- there, which is precisely the bug being fixed.
--
-- ══ 2 · THE ANIMATED MONOGRAM PRICE LIVES IN MIGRATIONS TOO ════════════════
--
-- Owner ruling 2026-09-05: ₱1,000 → ₱500. The SKU lost the LED Live Background
-- on 2026-08-11 ("that half of the ₱1,000 could never be delivered") and kept
-- its number; what it still buys is the six CSS animation signatures, on a mark
-- whose maker is already free.
--
-- The row was repriced directly in production first (through the same shape
-- `/admin/pricing` writes: guarded update + an `admin_audit_log` row). That was
-- not enough, and `llms-fixture-matches-the-catalog.db.test.ts` said so:
-- **the replayed catalogue is built from these migration files**, so it still
-- read ₱1,000 and disagreed with the repriced fixture.
--
-- 🔑 AN ADMIN-EDITABLE PRICE IS STILL SEEDED BY A MIGRATION. Changing prod
-- alone leaves the repo's own reality a reprice behind — the same class of
-- defect as the llms.txt fixture drift this repo has already paid for, just
-- pointing the other way. Both halves move, or neither is true.
--
-- Idempotent by construction: the UPDATE is a no-op against a row already at
-- 500 (production, right now), and sets it for any environment replaying from
-- scratch.

-- ── 1 · the union of both reserved-word lists ──────────────────────────────
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
      -- ⬇ ADDED 2026-09-05 by 20271205860548, and RE-STATED here because that
      -- file and the one above replaced each other. The other three free tools'
      -- public pages, shipped in the change that makes them the tenth to
      -- twelfth Studio rows.
      'marketplace', 'guest-list', 'seat-plan',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;

-- ── 2 · the Animated Monogram is ₱500 ──────────────────────────────────────
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 500
 WHERE service_code = 'ANIMATED_MONOGRAM'
   AND retail_price_php <> 500;

DO $$
DECLARE r record;
BEGIN
  SELECT retail_price_php, is_active INTO r
    FROM public.platform_retail_catalog_v2
   WHERE service_code = 'ANIMATED_MONOGRAM';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANIMATED_MONOGRAM has no catalogue row — the reprice cannot be verified';
  END IF;
  IF r.retail_price_php <> 500 THEN
    RAISE EXCEPTION 'ANIMATED_MONOGRAM price did not settle (got %)', r.retail_price_php;
  END IF;
END $$;
