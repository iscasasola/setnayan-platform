-- ============================================================================
-- 📰 ARTICLES LIVE ON THE CHAPTER STORE — Build 2 of 3 (drawing v15, owner-approved 2026-11-17)
-- ============================================================================
-- Owner rulings (DECISION_LOG 2026-11-17): Discover's articles are "our Reddit, cleaner" — text and links
-- only · a readable address /articles/{title} · tags (Tag ▾) · replies one level deep · people post under a
-- chosen name, and ANY account tied to a shop always posts as that shop, with the Supplier mark · new posts
-- show at once and Report takes one down. Controller relay on PR #7919: "Yes to the migration (slug, tags,
-- is_journal, posted_as_vendor_id, posting_name, replies table)".
--
-- ONE STORE, NOT TWO (Rule 0): `creator_chapters` already holds a title, a body (≤ 20,000) and an audience
-- (draft · event · published). This migration ADDS to it; nothing is renamed or dropped. An article is a
-- published chapter with a slug.
--
-- 🔑 THE ROW IS YOURS — THE FIELD IS NOT. Three of the new fields record something the writer must not
-- choose: `is_journal` (Setnayan's own byline), `posted_as_vendor_id` (who the post speaks for) and a reply's
-- `removed_at` (a moderator's decision). Each is held by a trigger that ignores what a signed-in session
-- sends. "Privileged" is derived from `current_user NOT IN ('authenticated','anon')`, never from
-- `auth.role() IS NULL`, which can never be NULL in the PGlite replay (2026-08-12 lesson).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. creator_chapters — slug · tags · is_journal · posted_as_vendor_id · removed_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.creator_chapters
  ADD COLUMN IF NOT EXISTS slug                TEXT,
  ADD COLUMN IF NOT EXISTS tags                TEXT[]      NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS is_journal          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS posted_as_vendor_id UUID        NULL
                             REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at          TIMESTAMPTZ NULL;

ALTER TABLE public.creator_chapters DROP CONSTRAINT IF EXISTS creator_chapters_slug_shape;
ALTER TABLE public.creator_chapters
  ADD CONSTRAINT creator_chapters_slug_shape
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120);

ALTER TABLE public.creator_chapters DROP CONSTRAINT IF EXISTS creator_chapters_tags_at_most_three;
ALTER TABLE public.creator_chapters
  ADD CONSTRAINT creator_chapters_tags_at_most_three
  CHECK (cardinality(tags) <= 3);

CREATE UNIQUE INDEX IF NOT EXISTS creator_chapters_slug_key
  ON public.creator_chapters (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS creator_chapters_tags_gin
  ON public.creator_chapters USING GIN (tags);
CREATE INDEX IF NOT EXISTS creator_chapters_posted_as_vendor_idx
  ON public.creator_chapters (posted_as_vendor_id) WHERE posted_as_vendor_id IS NOT NULL;

COMMENT ON COLUMN public.creator_chapters.slug IS
  'The article''s readable address: /articles/{slug} (owner 2026-11-17). Minted from the title on insert, '
  'unique, and never changed by the writer afterwards — a shared link must keep working when a title is edited.';
COMMENT ON COLUMN public.creator_chapters.tags IS
  'Up to 3 lower-case tags (Tag ▾ on the feed; onboarding''s "Not sure yet" links by tag).';
COMMENT ON COLUMN public.creator_chapters.is_journal IS
  'TRUE = a Setnayan Journal post (byline "Setnayan Journal"). Only a privileged writer (the import migration, '
  'the service role) can set it; a signed-in session''s value is ignored by trigger.';
COMMENT ON COLUMN public.creator_chapters.posted_as_vendor_id IS
  'The shop this post speaks for. Stamped by trigger from the author''s shop membership (owner or team) at '
  'insert — a supplier-linked account ALWAYS posts as its shop (owner 2026-11-17), and nobody can choose it.';
COMMENT ON COLUMN public.creator_chapters.removed_at IS
  'Set when a moderator takes the post down from a report (Q6: "Report takes one down"). A removed article '
  'leaves the public read, the feed and the article sitemap.';

-- 1a. The slug minter. Pure SQL: lower-case, ASCII letters/digits, hyphen-joined, ≤ 80 chars, and a numeric
--     suffix when the base is taken. Unaccented by translate() for the Filipino/Spanish letters our titles use.
CREATE OR REPLACE FUNCTION public.article_slug_base(p_title TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(
      left(
        trim(BOTH '-' FROM regexp_replace(
          lower(translate(coalesce(p_title, ''), 'ÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑáàâäãéèêëíìîïóòôöõúùûüñ’''',
                                                 'AAAAAEEEEIIIIOOOOOUUUUNaaaaaeeeeiiiiooooouuuun')),
          '[^a-z0-9]+', '-', 'g')),
        80),
      ''),
    'post')
$$;

-- SECURITY DEFINER on purpose: under the writer's own RLS it would not see other people's drafts, and the
-- insert would then collide on the unique index with a message the writer cannot act on.
CREATE OR REPLACE FUNCTION public.article_unique_slug(p_title TEXT, p_chapter_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT := trim(BOTH '-' FROM public.article_slug_base(p_title));
  v_try  TEXT := v_base;
  v_n    INT  := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.creator_chapters c
                 WHERE c.slug = v_try AND c.chapter_id IS DISTINCT FROM p_chapter_id) LOOP
    v_n := v_n + 1;
    v_try := v_base || '-' || v_n;
  END LOOP;
  RETURN v_try;
END;
$$;

-- 1b. Whose shop does this account speak for? The owner's own shop first, then any team seat (owner ruling:
--     "user account related to the supplier will always show their shop name"). SECURITY DEFINER so the
--     answer never depends on what the writer's own RLS happens to let them read.
CREATE OR REPLACE FUNCTION public.article_shop_of(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = p_user_id ORDER BY vp.created_at LIMIT 1),
    (SELECT tm.vendor_profile_id FROM public.vendor_team_members tm
      WHERE tm.user_id = p_user_id ORDER BY tm.created_at LIMIT 1)
  )
$$;
-- The invoker triggers below call both as the writer, so `authenticated` keeps EXECUTE; nobody else needs it.
REVOKE ALL ON FUNCTION public.article_shop_of(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.article_unique_slug(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.article_shop_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.article_unique_slug(TEXT, UUID) TO authenticated;

-- 1c. The guard: the writer chooses the title, the body and the tags. Setnayan chooses the rest.
--     ⚠ SECURITY INVOKER, deliberately: inside a SECURITY DEFINER function `current_user` is the function's
--     OWNER, so the privileged test below would be true for every caller (the 2026-08-24 trap). The two
--     lookups that need to see past RLS are the DEFINER helpers above.
CREATE OR REPLACE FUNCTION public.creator_chapters_article_fields_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_privileged BOOLEAN := current_user NOT IN ('authenticated', 'anon');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_privileged THEN
      NEW.is_journal := FALSE;
      NEW.removed_at := NULL;
      NEW.slug := NULL;           -- always minted, never typed
      NEW.posted_as_vendor_id := public.article_shop_of(NEW.user_id);
    END IF;
    IF NEW.slug IS NULL THEN
      NEW.slug := public.article_unique_slug(NEW.title, NEW.chapter_id);
    END IF;
  ELSE
    IF NOT v_privileged THEN
      NEW.is_journal := OLD.is_journal;
      NEW.removed_at := OLD.removed_at;
      NEW.slug := OLD.slug;
      NEW.posted_as_vendor_id := OLD.posted_as_vendor_id;
    END IF;
    IF NEW.slug IS NULL THEN
      NEW.slug := public.article_unique_slug(NEW.title, NEW.chapter_id);
    END IF;
  END IF;
  -- Tags are stored the way they are matched: trimmed, lower-case, de-duplicated, empties dropped.
  NEW.tags := coalesce(ARRAY(
    SELECT DISTINCT ON (t) t FROM (
      SELECT lower(btrim(x)) AS t FROM unnest(coalesce(NEW.tags, '{}'::text[])) AS x
    ) s WHERE t <> '' AND length(t) <= 30
  ), '{}'::text[]);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_chapters_article_fields_guard ON public.creator_chapters;
CREATE TRIGGER creator_chapters_article_fields_guard
  BEFORE INSERT OR UPDATE ON public.creator_chapters
  FOR EACH ROW EXECUTE FUNCTION public.creator_chapters_article_fields_guard();

-- 1d. Every chapter that already exists gets its address (the trigger fills a NULL slug on update).
UPDATE public.creator_chapters SET updated_at = updated_at WHERE slug IS NULL;

-- 1e. THE PUBLIC READ OF AN ARTICLE. A published, not-removed chapter with an address is public — readers
--     see the posting name or the shop, never the account (owner: "they can stay anonymous"). The older
--     policy (published on a public profile) stays exactly as it is; this one is added beside it.
DROP POLICY IF EXISTS public_can_read_published_article ON public.creator_chapters;
CREATE POLICY public_can_read_published_article ON public.creator_chapters
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND slug IS NOT NULL AND removed_at IS NULL);

-- ---------------------------------------------------------------------------
-- 2. users.posting_name — the name a person posts under, set on their first post
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS posting_name TEXT NULL;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_posting_name_shape;
ALTER TABLE public.users
  ADD CONSTRAINT users_posting_name_shape
  CHECK (posting_name IS NULL OR posting_name ~ '^[a-z0-9][a-z0-9._]{2,29}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_posting_name_key
  ON public.users (lower(posting_name)) WHERE posting_name IS NOT NULL;

COMMENT ON COLUMN public.users.posting_name IS
  'The name shown on this person''s articles and replies (owner 2026-11-17: "they can stay anonymous"). '
  'Unique, 3–30 of a-z 0-9 . _ ; chosen on the first post. The account behind it stays real, so Report '
  'and bans still work. Ignored for anybody tied to a shop — they always post as the shop.';

-- ---------------------------------------------------------------------------
-- 3. creator_chapter_replies — replies, ONE level deep (no parent column, by design)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_chapter_replies (
  id                  BIGSERIAL PRIMARY KEY,
  reply_id            UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  chapter_id          UUID        NOT NULL REFERENCES public.creator_chapters(chapter_id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  posted_as_vendor_id UUID        NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  body                TEXT        NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  removed_at          TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creator_chapter_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS creator_chapter_replies_chapter_idx
  ON public.creator_chapter_replies (chapter_id, created_at);
CREATE INDEX IF NOT EXISTS creator_chapter_replies_user_idx
  ON public.creator_chapter_replies (user_id);

COMMENT ON TABLE public.creator_chapter_replies IS
  'Replies to an article (a published creator_chapters row). ONE level deep: there is no parent column, so a '
  'reply cannot answer a reply (owner 2026-11-17). Shown under the writer''s posting name, or their shop.';

-- 3a. Who reads, who writes. Pattern: public read of live replies on a live article · own-row write.
DROP POLICY IF EXISTS replies_public_read ON public.creator_chapter_replies;
CREATE POLICY replies_public_read ON public.creator_chapter_replies
  FOR SELECT TO anon, authenticated
  USING (
    removed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.creator_chapters c
       WHERE c.chapter_id = creator_chapter_replies.chapter_id
         AND c.status = 'published' AND c.slug IS NOT NULL AND c.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS replies_author_reads_own ON public.creator_chapter_replies;
CREATE POLICY replies_author_reads_own ON public.creator_chapter_replies
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS replies_author_inserts ON public.creator_chapter_replies;
CREATE POLICY replies_author_inserts ON public.creator_chapter_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.creator_chapters c
       WHERE c.chapter_id = creator_chapter_replies.chapter_id
         AND c.status = 'published' AND c.slug IS NOT NULL AND c.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS replies_author_updates ON public.creator_chapter_replies;
CREATE POLICY replies_author_updates ON public.creator_chapter_replies
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS replies_author_deletes ON public.creator_chapter_replies;
CREATE POLICY replies_author_deletes ON public.creator_chapter_replies
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS replies_admin_all ON public.creator_chapter_replies;
CREATE POLICY replies_admin_all ON public.creator_chapter_replies
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 3b. The verbs, enumerated FROM THE POLICIES above (2026-08-24 lesson: a policy with no grant is a button
--     that does nothing). Table-level revoke first, so no column keeps a stray grant.
REVOKE ALL ON public.creator_chapter_replies FROM anon, authenticated;
GRANT SELECT ON public.creator_chapter_replies TO anon;
GRANT SELECT, INSERT, DELETE ON public.creator_chapter_replies TO authenticated;
GRANT UPDATE (body, updated_at) ON public.creator_chapter_replies TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.creator_chapter_replies_id_seq TO authenticated;

-- 3c. The guard: the writer chooses the words. Setnayan chooses whom they speak for and whether they stand.
-- SECURITY INVOKER for the same reason as the chapter guard above.
CREATE OR REPLACE FUNCTION public.creator_chapter_replies_fields_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_privileged BOOLEAN := current_user NOT IN ('authenticated', 'anon');
BEGIN
  IF v_privileged THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.removed_at := NULL;
    NEW.posted_as_vendor_id := public.article_shop_of(NEW.user_id);
  ELSE
    NEW.chapter_id := OLD.chapter_id;
    NEW.user_id := OLD.user_id;
    NEW.posted_as_vendor_id := OLD.posted_as_vendor_id;
    NEW.removed_at := OLD.removed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_chapter_replies_fields_guard ON public.creator_chapter_replies;
CREATE TRIGGER creator_chapter_replies_fields_guard
  BEFORE INSERT OR UPDATE ON public.creator_chapter_replies
  FOR EACH ROW EXECUTE FUNCTION public.creator_chapter_replies_fields_guard();

-- ---------------------------------------------------------------------------
-- 4. Report a reply. Re-listed from the LIVE constraint (20271240604358) + 'chapter_reply'.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_target_type_check;
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
      -- 2026-11-17 Build 2: target_id = creator_chapter_replies.reply_id, event_id NULL.
      'chapter_reply'::text
    ]));

-- A reply (like a chapter) has no event. 'vendor' is added here too: its target migration (20271240604358)
-- writes event_id NULL and never widened this check, so a shop report would be refused at insert — found by
-- PR #7835 and carried here, the PR that replaces it.
ALTER TABLE public.user_reports DROP CONSTRAINT IF EXISTS user_reports_event_id_required_check;
ALTER TABLE public.user_reports
  ADD CONSTRAINT user_reports_event_id_required_check
  CHECK (target_type IN ('user_profile', 'chapter', 'vendor', 'chapter_reply') OR event_id IS NOT NULL);

COMMENT ON CONSTRAINT user_reports_target_type_check ON public.user_reports IS
  'The reportable surfaces. Extended 2026-11-17 with ''chapter_reply'' (article replies). ⚠ Re-list this from '
  'the LIVE constraint, never from an older migration: a retyped list drops whatever was added since.';

-- ---------------------------------------------------------------------------
-- 5. "articles" is our page: no shop may mint it as an address. Re-listed from the LIVE function
--    (20271308786674) + one word; the app list (lib/reserved-slugs.ts) gains the same word.
-- ---------------------------------------------------------------------------
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
      -- ⬇ ADDED 2026-11-17 (Build 2, 20271350349649). Discover's articles live at /articles/{slug}; a shop
      -- called "Articles" would hold this word forever. NOT verified in prod (a builder reads no production
      -- data) — owner check: select count(*) from vendor_profiles where lower(business_slug)='articles';
      'articles',
      -- Next.js internals / special files
      '_next', 'static', 'public', 'manifest.json', 'sw.js', 'icon-192.svg',
      'icon-512.svg'
    ]::text[]);
  $function$;
