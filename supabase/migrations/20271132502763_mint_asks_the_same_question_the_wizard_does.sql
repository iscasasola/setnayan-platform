-- ============================================================================
-- THE WIZARD PREVIEWED A SAFE ADDRESS WHILE THE DATABASE MINTED A COLLIDING ONE.
--
-- Two answers to one question — "is this word free?" — and they disagreed.
--
--   • THE APP asks `findSlugConflict` (lib/slug-availability.ts), which checks
--     FIVE sources: the reserved list, weddings, shops, PEOPLE, and retired
--     addresses still forwarding. It fails CLOSED on a probe it cannot run.
--
--   • THE DATABASE'S OWN AUTO-MINT asked THREE: `business_slug_is_reserved`,
--     shops, weddings. No people. No forwarding ledger. And its reserved list
--     was a SECOND hand-typed copy that had drifted 15 words behind the app's.
--
-- Two live, sitemapped pages were among those fifteen: `/creators` and
-- `/open-shop`. A vendor registering a business named "Creators" would have
-- been silently minted `setnayan.com/creators` — permanently, because a shop
-- address is immutable — shadowing a real Setnayan page. Nobody would have seen
-- it happen: the vendor is shown a preview computed by the APP, which would
-- have said the word was taken.
--
-- This migration makes the database ask the SAME question, in ONE place.
--
-- 🔑 WHY NOT JUST SYNC THE WORD LIST. Because the word list was only one of the
-- three holes, and the smallest. A hand-typed mirror can only ever be as fresh
-- as the last person who remembered — `tests/db/vendor-business-slug-mint.db.test.ts`
-- exists precisely because it had already rotted once. The other two holes
-- (people, forwarding) are not word lists at all and could never be closed by
-- typing harder.
--
-- ⚠ NOTHING IS RETROACTIVE. Both production shop addresses were checked before
-- writing this and neither is affected. This changes what the mint HANDS OUT
-- next, and the immutability trigger means it never revisits one it already
-- gave.
-- ============================================================================

BEGIN;

-- ── 1 · The reserved word list catches up with the routes that exist ────────
--
-- The 15 additions are every word in `KNOWN_DB_MINT_GAP`, the baseline that has
-- been carrying this debt LOUDLY since 2026-08-09. That baseline is emptied in
-- the same PR, so a NEW top-level page appearing tomorrow turns the test red
-- instead of quietly becoming mintable.
CREATE OR REPLACE FUNCTION public.business_slug_is_reserved(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
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
    -- Next.js internals / special files
    '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
    'icon-512.svg'
  ]::text[]);
$function$;

-- ── 2 · ONE availability answer, database-side ──────────────────────────────
--
-- Mirrors `findSlugConflict`'s five sources. Extracted as its own function so
-- the mint's main loop and its LAST-RESORT fallback cannot drift apart — the
-- fallback previously checked the word list ONLY, so the one path taken when
-- everything else failed was also the least careful one.
--
-- SECURITY DEFINER + a pinned search_path: it reads `users` and
-- `slug_change_log`, which the vendor's own role cannot see. Under the caller's
-- RLS those reads would come back empty and "free" would just mean "invisible
-- to you" — an RLS denial and an empty read are the same value.
CREATE OR REPLACE FUNCTION public.business_slug_is_available(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p_slug IS NOT NULL
    AND length(p_slug) >= 3
    AND NOT public.business_slug_is_reserved(p_slug)
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
       WHERE lower(vp.business_slug) = lower(p_slug)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.events e
       WHERE lower(e.slug) = lower(p_slug)
    )
    -- PEOPLE. Handles live in the same top-level namespace
    -- (`setnayan.com/{word}` → `/u/{word}`) and the mint never asked.
    AND NOT EXISTS (
      SELECT 1 FROM public.users u
       WHERE lower(u.slug) = lower(p_slug)
    )
    -- RETIRED ADDRESSES STILL LIVE. Covers BOTH ledger meanings, because both
    -- make the word unusable:
    --   · a rename still forwarding — minting it would put a shop at an address
    --     that bounces its own visitors to a stranger's page;
    --   · a closed shop's one-year hold (owner-locked 2026-08-10) — handing the
    --     word to a new business is exactly what that hold exists to prevent.
    AND NOT EXISTS (
      SELECT 1 FROM public.slug_change_log scl
       WHERE lower(scl.old_slug) = lower(p_slug)
         AND scl.redirect_until > now()
    );
$function$;

REVOKE ALL ON FUNCTION public.business_slug_is_available(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.business_slug_is_available(text) FROM anon, authenticated;

COMMENT ON FUNCTION public.business_slug_is_available(text) IS
  'Database-side mirror of lib/slug-availability.ts findSlugConflict: reserved · '
  'weddings · shops · people · live ledger holds. Used by the auto-mint so the '
  'address the wizard PREVIEWS and the address the database HANDS OUT are the '
  'same answer. Not granted to anon/authenticated — the app asks findSlugConflict.';

-- ── 3 · The mint asks the shared question, on BOTH paths ────────────────────
CREATE OR REPLACE FUNCTION public.generate_business_slug_for_vendor(p_vendor_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing     TEXT;
  v_name         TEXT;
  v_public_id    TEXT;
  v_base         TEXT;
  v_candidate    TEXT;
  v_suffix       TEXT;
  v_attempt      INT := 1;
  v_max_attempts CONSTANT INT := 50;
BEGIN
  SELECT business_slug, business_name, public_id
    INTO v_existing, v_name, v_public_id
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;

  -- Never reissue a live address.
  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
    RETURN;
  END IF;

  v_base := public.slugify_business_name(v_name);

  -- 1–2 chars is legal for a business name but not for an address; borrow four
  -- characters of the row's own public id rather than discarding the name.
  IF v_base IS NOT NULL AND length(v_base) < 3 AND v_public_id IS NOT NULL THEN
    v_base := v_base || lower(right(v_public_id, 4));
  END IF;

  IF v_base IS NULL OR length(v_base) < 3 THEN
    v_base := lower(coalesce(v_public_id, ''));
  END IF;

  IF length(v_base) < 3 THEN
    RETURN;
  END IF;

  WHILE v_attempt <= v_max_attempts LOOP
    IF v_attempt = 1 THEN
      v_candidate := public.clip_business_slug(v_base, 32);
    ELSE
      v_suffix := v_attempt::text;
      v_candidate :=
        public.clip_business_slug(v_base, 32 - length(v_suffix)) || v_suffix;
    END IF;

    IF public.business_slug_is_available(v_candidate) THEN
      BEGIN
        UPDATE public.vendor_profiles
           SET business_slug = v_candidate
         WHERE vendor_profile_id = p_vendor_profile_id
           AND business_slug IS NULL;
        RETURN;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END IF;

    v_attempt := v_attempt + 1;
  END LOOP;

  -- LAST RESORT: the row's own public id. ⚠ This branch used to check the word
  -- list ONLY — so the path taken after fifty failures was the one that asked
  -- the fewest questions. It asks the same question as everything else now.
  v_candidate := lower(coalesce(v_public_id, ''));
  IF public.business_slug_is_available(v_candidate) THEN
    BEGIN
      UPDATE public.vendor_profiles
         SET business_slug = v_candidate
       WHERE vendor_profile_id = p_vendor_profile_id
         AND business_slug IS NULL;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
END;
$function$;

COMMIT;
