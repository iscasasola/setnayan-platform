-- event_address_owner_and_usernames
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- THE ADDRESS MOVE, PART 2 — EVENTS AT /{username}/{event} (owner 2026-11-15, specs DECISION_LOG d7910b5d;
-- map ADDRESS_MOVE_MAP_2026-11-15_fable.md). Add-only. RLS is untouched (no new table).
--
--   1. `events.created_by_user_id` — WHOSE username an event's address uses. Owner: "an event's address uses the
--      CREATOR's username". `events` had no creator column (map § 2), so it is added here, nullable, and filled:
--        · from now on, by a trigger: the FIRST `couple` member an event gets is its creator (every create path
--          adds the creator as the event's first couple member, in app code or the onboarding commit);
--        · for existing events, ONCE, below: the existing lowest-`user_id` couple member — the same tie-break the
--          app's `resolveEventOwnerSlug` already used, so no event's address changes because of this backfill.
--      🔒 NO GRANT, on purpose: `public.events` holds no table-level grant for anon or authenticated, so the column
--      is service-role only (the address is resolved with the service role). Deny-listed with its reason in
--      apps/web/scripts/lint-events-column-grants.mjs.
--   2. `mint_user_username(user)` — owner: "a username is made automatically from the person's name and shown
--      once, changeable". Same pipeline as a shop address (`slugify_business_name`, `clip_business_slug`) and the
--      SAME one-pool question (`business_slug_is_available`: reserved words · events · shops · people · live
--      forwarding holds). It never overwrites a chosen username, never mints from an empty name (a machine code
--      on an invitation forever is worse than the old address), and stamps `users.username_minted_at` so the app
--      can say it ONCE (`users.username_minted_seen_at`).
--   3. A trigger mints the creator's username when their first event is made.
--   4. BACKFILL (runs ONCE, ONLY through the pipeline — `supabase db push --include-all` on deploy; never by hand,
--      never from a session): the creator column for existing events, then a username for every creator who has
--      none. Map § 2 measured 22 of 25 events whose owners had no username.
--   5. The reserved words the move needs (c · invite · dates · booth · review · guest-review · cached) join the
--      database's reserved list. The body below is 20271308786674's, word for word, plus those words — that file
--      was the last to replace this function (re-checked with
--      `grep -l "FUNCTION public.business_slug_is_reserved" supabase/migrations/*.sql | sort | tail -1`).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1 · The creator column ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.created_by_user_id IS
  'The account that created the event — its address is setnayan.com/{this person''s username}/{event slug} '
  '(the address move, 2026-11-15). Set by tg_event_members_stamp_creator (the first couple member) and '
  'backfilled once from the lowest-user_id couple member. Service-role only.';

CREATE INDEX IF NOT EXISTS events_created_by_user_id_idx ON public.events (created_by_user_id);

-- ── 2 · The username mint ───────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username_minted_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username_minted_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.username_minted_at IS
  'When Setnayan made this person''s username from their name (mint_user_username). NULL = they chose it, or '
  'have none. The app shows the made-up username ONCE, then stamps username_minted_seen_at.';
COMMENT ON COLUMN public.users.username_minted_seen_at IS
  'When the person was shown the username Setnayan made for them (once).';

CREATE OR REPLACE FUNCTION public.mint_user_username(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing     TEXT;
  v_name         TEXT;
  v_base         TEXT;
  v_candidate    TEXT;
  v_suffix       TEXT;
  v_attempt      INT := 1;
  v_max_attempts CONSTANT INT := 50;
BEGIN
  SELECT slug, display_name INTO v_existing, v_name FROM public.users WHERE user_id = p_user_id;

  -- Never replace a username — chosen or minted. An address is never reissued.
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
    RETURN NULL;
  END IF;

  v_base := public.slugify_business_name(v_name);
  -- Too short to be an address on its own — no machine code is borrowed for a PERSON (it would print on their
  -- invitations forever); they keep the old address until they choose one.
  IF v_base IS NULL OR length(v_base) < 3 THEN
    RETURN NULL;
  END IF;

  WHILE v_attempt <= v_max_attempts LOOP
    IF v_attempt = 1 THEN
      v_candidate := public.clip_business_slug(v_base, 32);
    ELSE
      v_suffix := v_attempt::text;
      v_candidate := public.clip_business_slug(v_base, 32 - length(v_suffix)) || v_suffix;
    END IF;

    IF v_candidate ~ '^[a-z0-9-]{3,32}$' AND public.business_slug_is_available(v_candidate) THEN
      BEGIN
        UPDATE public.users
           SET slug = v_candidate,
               username_minted_at = now()
         WHERE user_id = p_user_id
           AND slug IS NULL;
        IF FOUND THEN
          RETURN v_candidate;
        END IF;
        -- Somebody chose one in the meantime — keep theirs.
        SELECT slug INTO v_existing FROM public.users WHERE user_id = p_user_id;
        RETURN v_existing;
      EXCEPTION WHEN unique_violation THEN
        -- Taken between the question and the write — try the next number.
        NULL;
      END;
    END IF;
    v_attempt := v_attempt + 1;
  END LOOP;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mint_user_username(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_user_username(uuid) FROM anon, authenticated;

COMMENT ON FUNCTION public.mint_user_username(uuid) IS
  'Makes a username from the person''s name when they have none (the address move, 2026-11-15). Same pipeline '
  'and the same one-pool question as a shop address. Never replaces a username; never mints from an empty name. '
  'Service-role / trigger only.';

-- ── 3 · The first couple member is the creator; their username is made then ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_event_members_stamp_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.member_type = 'couple' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.events
       SET created_by_user_id = NEW.user_id
     WHERE event_id = NEW.event_id
       AND created_by_user_id IS NULL;
    IF FOUND THEN
      PERFORM public.mint_user_username(NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tg_event_members_stamp_creator() FROM PUBLIC;

DROP TRIGGER IF EXISTS event_members_stamp_creator ON public.event_members;
CREATE TRIGGER event_members_stamp_creator
  AFTER INSERT ON public.event_members
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_event_members_stamp_creator();

-- ── 4 · BACKFILL — once, through the pipeline only ──────────────────────────────────────────────────────────────
UPDATE public.events e
   SET created_by_user_id = m.user_id
  FROM (
    SELECT DISTINCT ON (event_id) event_id, user_id
      FROM public.event_members
     WHERE member_type = 'couple' AND user_id IS NOT NULL
     ORDER BY event_id, user_id
  ) m
 WHERE m.event_id = e.event_id
   AND e.created_by_user_id IS NULL
   AND EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = m.user_id);

DO $backfill$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT e.created_by_user_id AS user_id
      FROM public.events e
      JOIN public.users u ON u.user_id = e.created_by_user_id
     WHERE u.slug IS NULL
  LOOP
    PERFORM public.mint_user_username(r.user_id);
  END LOOP;
END
$backfill$;

-- ── 5 · The reserved words ──────────────────────────────────────────────────────────────────────────────────────
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
      -- ⬇ ADDED 2026-11-16 by 20271349094219 (the address move, owner 2026-11-15, specs DECISION_LOG
      -- d7910b5d). The words that sit UNDER a person or a shop — `/{user}/c/{id}` (a chapter),
      -- `/{shop}/invite`, `/{shop}/dates` · `booth` · `review` · `guest-review`, and the cached copies
      -- (`cached`) — so `/{x}/{y}` never needs a guess. Mirrored by DB_MIRRORED_RESERVED_SLUGS in
      -- apps/web/lib/reserved-slugs.ts. NOT verified in prod (a builder session reads no production
      -- data) — owner check: select slug from events where lower(slug) in ('invite','dates','booth',
      -- 'review','guest-review','cached') union all select business_slug from vendor_profiles where
      -- lower(business_slug) in (…) union all select slug from users where lower(slug) in (…);
      -- `c` is one character and could never be an address (the format needs 3), listed for the record.
      'c', 'invite', 'dates', 'booth', 'review', 'guest-review', 'cached',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
