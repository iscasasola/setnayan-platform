-- articles_topics_and_replies — ARTICLES: topics people start and talk in.
--
-- Created via `pnpm migration:new`. Idempotent (may be re-applied).
--
-- ── THE RULING ──────────────────────────────────────────────────────────────
-- DECISION_LOG 2026-11-16 (specs repo): "a place where people can discuss and
-- create topics inside like reddit" · "purely public use" · links only to
-- setnayan.com · anonymous to readers, known to Setnayan (448fd3c1) · the
-- Articles prototype (prototypes/articles_2026-11-16/) ruled "1a 2a 3a":
--   (1) posts go live at once; the team acts on reports,
--   (2) suppliers may post, marked "Supplier · code",
--   (3) a topic's exact link opens read-only signed out.
--
-- ── FOUR TABLES ─────────────────────────────────────────────────────────────
--   article_topics          one row per topic
--   article_replies         one row per reply inside a topic
--   article_topic_codes     the ONE code a person wears inside ONE topic
--                           ("Guest · 3F"). PK (topic_id, user_id) is what makes
--                           "one code per person per topic" a fact, and the
--                           UNIQUE (topic_id, code) is what makes two people in
--                           one topic never share a code. A different topic
--                           gets a different row, so nobody can be followed
--                           across topics by their code.
--   article_posting_pauses  "Remove and pause posting" — an account paused here
--                           cannot post in Articles. It can still read, plan
--                           and book (the pause is Articles only).
--
-- ── WHY RLS PATTERN F (ADMIN-ONLY), NOT D (PUBLIC READ) ─────────────────────
-- Every row carries the REAL account (`author_user_id`). Pattern D would let any
-- signed-in browser select that column straight through PostgREST with the
-- anon key, and "anonymous to readers" would be a UI convention, not a fact.
-- So the client can read NOTHING here: every reader goes through the server
-- (lib/articles.server.ts), which selects with the service client and hands
-- the page only the code and the kind — never the account. Admins read all
-- (Admin › User reports shows who posted).
--
-- ── user_reports ────────────────────────────────────────────────────────────
-- Two new report targets, 'article_topic' and 'article_reply' (target_id =
-- the topic's public_id / the reply's reply_id). Both are not tied to an event,
-- so they join the event_id-may-be-NULL list.
--
-- ⚠ THE target_type LIST BELOW IS THE LIST FROM 20271240604358 (which was read
-- from production on 2026-09-22) PLUS TWO. No migration since has touched it.
--
-- ⚠ AND THE event_id LIST GAINS 'vendor' TOO. 20271240604358 added 'vendor' as a
-- target and its report path (lib/reports.ts) inserts it with event_id NULL,
-- but it never widened user_reports_event_id_required_check, whose last
-- definition (20270817834616) allows NULL only for user_profile and chapter.
-- Loosening only — no row that passes today fails after this.

-- ----------------------------------------------------------------------------
-- 1. article_topics
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_topics (
  id                BIGSERIAL PRIMARY KEY,
  topic_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('A'),
  author_user_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  event_type        TEXT REFERENCES public.event_type_vocab(event_type),
  title             TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  body              TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  reply_count       INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at        TIMESTAMPTZ,
  removed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.article_topics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS article_topics_live_newest_idx
  ON public.article_topics (created_at DESC) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS article_topics_live_replies_idx
  ON public.article_topics (reply_count DESC, last_activity_at DESC) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS article_topics_author_idx
  ON public.article_topics (author_user_id);

DROP POLICY IF EXISTS article_topics_admin_only ON public.article_topics;
CREATE POLICY article_topics_admin_only ON public.article_topics
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.article_topics IS
  'Articles (DECISION_LOG 2026-11-16): a topic anyone signed in starts. RLS is '
  'Pattern F on purpose — author_user_id is the real account and readers must '
  'never be able to select it; pages read through the server with the service '
  'client and show only the per-topic code (article_topic_codes).';

-- ----------------------------------------------------------------------------
-- 2. article_topic_codes — one code per person per topic
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_topic_codes (
  topic_id     UUID NOT NULL REFERENCES public.article_topics(topic_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  code         TEXT NOT NULL CHECK (code ~ '^[0-9A-Z]{2,4}$'),
  -- 'supplier' when the person owned a shop or sat on a shop's team the first
  -- time they posted in this topic (ruling 2: "Supplier · code", never Guest).
  author_kind  TEXT NOT NULL CHECK (author_kind IN ('guest', 'supplier')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (topic_id, user_id),
  CONSTRAINT article_topic_codes_one_code_per_topic UNIQUE (topic_id, code)
);

ALTER TABLE public.article_topic_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS article_topic_codes_user_idx
  ON public.article_topic_codes (user_id);

DROP POLICY IF EXISTS article_topic_codes_admin_only ON public.article_topic_codes;
CREATE POLICY article_topic_codes_admin_only ON public.article_topic_codes
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.article_topic_codes IS
  'The one code a person wears inside one Articles topic ("Guest · 3F" / '
  '"Supplier · 7K"). PK (topic_id, user_id) = one code per person per topic; '
  'UNIQUE (topic_id, code) = no two people share one. Admin-only RLS (Pattern F).';

-- ----------------------------------------------------------------------------
-- 3. article_replies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_replies (
  id              BIGSERIAL PRIMARY KEY,
  reply_id        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  topic_id        UUID NOT NULL REFERENCES public.article_topics(topic_id) ON DELETE CASCADE,
  author_user_id  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  removed_at      TIMESTAMPTZ,
  removed_by      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A reply can only be written by somebody who already holds this topic's
  -- code — the code row is made first, in the same request.
  CONSTRAINT article_replies_author_has_a_code
    FOREIGN KEY (topic_id, author_user_id)
    REFERENCES public.article_topic_codes (topic_id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.article_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS article_replies_topic_idx
  ON public.article_replies (topic_id, created_at);
CREATE INDEX IF NOT EXISTS article_replies_author_idx
  ON public.article_replies (author_user_id);

DROP POLICY IF EXISTS article_replies_admin_only ON public.article_replies;
CREATE POLICY article_replies_admin_only ON public.article_replies
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.article_replies IS
  'A reply inside an Articles topic. Admin-only RLS (Pattern F) for the same '
  'reason as article_topics: author_user_id is the real account.';

-- The topic's reply count and last activity follow its live replies. One
-- trigger so the number on the list can never disagree with the thread.
CREATE OR REPLACE FUNCTION public.article_topic_follows_its_replies()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.removed_at IS NULL THEN
      UPDATE public.article_topics
         SET reply_count = reply_count + 1,
             last_activity_at = GREATEST(last_activity_at, NEW.created_at)
       WHERE topic_id = NEW.topic_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN
      UPDATE public.article_topics
         SET reply_count = GREATEST(reply_count - 1, 0)
       WHERE topic_id = NEW.topic_id;
    ELSIF OLD.removed_at IS NOT NULL AND NEW.removed_at IS NULL THEN
      UPDATE public.article_topics
         SET reply_count = reply_count + 1
       WHERE topic_id = NEW.topic_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS article_topic_follows_its_replies ON public.article_replies;
CREATE TRIGGER article_topic_follows_its_replies
  AFTER INSERT OR UPDATE OF removed_at ON public.article_replies
  FOR EACH ROW EXECUTE FUNCTION public.article_topic_follows_its_replies();

-- ----------------------------------------------------------------------------
-- 4. article_posting_pauses — "Remove and pause posting" (Articles only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_posting_pauses (
  user_id     UUID PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  paused_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_by   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  report_id   UUID REFERENCES public.user_reports(report_id) ON DELETE SET NULL
);

ALTER TABLE public.article_posting_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS article_posting_pauses_admin_only ON public.article_posting_pauses;
CREATE POLICY article_posting_pauses_admin_only ON public.article_posting_pauses
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.article_posting_pauses IS
  'An account paused from posting in Articles by a moderator (Admin › User '
  'reports → "Remove and pause posting"). Articles only: the account can still '
  'read, plan and book. Admin-only RLS (Pattern F).';

-- ----------------------------------------------------------------------------
-- 4b. No table privilege for anon at all (defence in depth beside Pattern F):
--     a signed-out reader reads a topic through the server, never PostgREST.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.article_topics FROM anon;
REVOKE ALL ON public.article_topic_codes FROM anon;
REVOKE ALL ON public.article_replies FROM anon;
REVOKE ALL ON public.article_posting_pauses FROM anon;

-- ----------------------------------------------------------------------------
-- 5. user_reports — two new targets
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_reports
  DROP CONSTRAINT IF EXISTS user_reports_target_type_check;
ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_target_type_check
    CHECK (target_type = ANY (ARRAY[
      'photo'::text,
      'comment'::text,
      'user'::text,
      'ai_output'::text,
      'event'::text,
      'user_profile'::text,
      'chapter'::text,
      'vendor'::text,
      -- Articles (2026-11-16). target_id = article_topics.public_id.
      'article_topic'::text,
      -- Articles (2026-11-16). target_id = article_replies.reply_id.
      'article_reply'::text
    ]));

ALTER TABLE public.user_reports
  DROP CONSTRAINT IF EXISTS user_reports_event_id_required_check;
ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_event_id_required_check
  CHECK (
    target_type IN ('user_profile', 'chapter', 'vendor', 'article_topic', 'article_reply')
    OR event_id IS NOT NULL
  );

COMMENT ON CONSTRAINT user_reports_target_type_check ON public.user_reports IS
  'The reportable surfaces. Extended 2026-11-16 with article_topic and '
  'article_reply (Articles). ⚠ Re-list this from the LIVE constraint, never from '
  'an older migration: a retyped list drops whatever was added since.';

-- ----------------------------------------------------------------------------
-- 6. "articles" is our page, never a shop's address.
--    Re-listed from the LAST definition (20271308786674 — no migration since
--    touches this function) plus one word. A shop address is immutable once
--    minted, so the word is reserved in the same change that ships the page.
-- ----------------------------------------------------------------------------
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
      -- ⬇ ADDED 2026-11-16 by 20271348464284. Articles (/articles, /articles/<topic>),
      -- owner-approved 16 Nov. A shop called "Articles" would hold this word forever and
      -- its address could never work. NOT verified in prod (a builder session reads no
      -- production data) — owner check:
      -- select count(*) from vendor_profiles where lower(business_slug)='articles';
      'articles',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
