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
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

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
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

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
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

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
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.article_posting_pauses IS
  'An account paused from posting in Articles by a moderator (Admin › User '
  'reports → "Remove and pause posting"). Articles only: the account can still '
  'read, plan and book. Admin-only RLS (Pattern F).';

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
