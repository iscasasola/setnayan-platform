-- Blog + Help CMS tables (admin-menu-recluster · 2026-06-18).
--
-- Moves /blog and /help content out of hardcoded lib/*.ts constants into
-- admin-manageable DB tables so the Setnayan team can publish and edit
-- content without a code deploy.
--
-- Both tables are DB-first / static-fallback: the public pages read DB
-- records first; when the DB has no published record for a slug they fall
-- back to the in-code constant (lib/blog.ts · lib/help.ts). This lets the
-- existing hardcoded articles keep working as a floor while the admin
-- gradually overrides and supplements them.
--
-- RLS strategy:
--   is_admin() INSERT/UPDATE/DELETE — only HQ staff write.
--   SELECT anon/authenticated for published rows — public read.
--   No couple/vendor row-scoping needed (these are editorial tables).

-- ── BLOG ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blog_articles (
  id            bigserial      PRIMARY KEY,
  slug          text           NOT NULL UNIQUE,
  title         text           NOT NULL,
  excerpt       text           NOT NULL DEFAULT '',
  category      text           NOT NULL DEFAULT 'planning'
    CHECK (category IN ('planning','vendors','culture','real-weddings','news')),
  author        text           NOT NULL DEFAULT 'Setnayan Editorial',
  published_at  date           NOT NULL DEFAULT CURRENT_DATE,
  updated_at    date,
  featured      boolean        NOT NULL DEFAULT false,
  cover_url     text           NOT NULL DEFAULT '',
  cover_alt     text           NOT NULL DEFAULT '',
  -- Body stored as lightweight markdown (## heading / > quote / - list / plain para).
  -- lib/blog-db.ts parseMdToBlocks() converts it to BlogBlock[] at read time so
  -- the existing public renderer requires no changes.
  body_md       text           NOT NULL DEFAULT '',
  status        text           NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  display_order integer        NOT NULL DEFAULT 0,
  created_at    timestamptz    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blog_articles IS
  'Admin-managed Setnayan Journal (blog) articles. DB rows override matching '
  'slugs in lib/blog.ts; slugs absent from DB fall back to the static constant.';

ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_articles_admin_all" ON public.blog_articles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "blog_articles_public_read" ON public.blog_articles
  FOR SELECT USING (status = 'published');

-- Only one article can be featured at a time (enforced at the server-action
-- layer — this index just speeds the featured-lookup query on the public page).
CREATE INDEX IF NOT EXISTS blog_articles_featured_idx
  ON public.blog_articles (featured) WHERE featured = true;

CREATE INDEX IF NOT EXISTS blog_articles_status_published_at_idx
  ON public.blog_articles (status, published_at DESC);

-- ── HELP ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.help_articles (
  id            bigserial      PRIMARY KEY,
  -- Must match a key from lib/help.ts HELP_TOPICS, or be a new admin-created key.
  topic_key     text           NOT NULL,
  slug          text           NOT NULL UNIQUE,
  title         text           NOT NULL,
  -- Plain-text body paragraph (matches the lib/help.ts HelpArticle.body shape).
  body          text           NOT NULL DEFAULT '',
  -- Role filter — subset of {'couple','vendor','guest','admin'}.
  roles         text[]         NOT NULL DEFAULT '{couple,vendor,guest,admin}',
  display_order integer        NOT NULL DEFAULT 0,
  is_published  boolean        NOT NULL DEFAULT true,
  created_at    timestamptz    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.help_articles IS
  'Admin-managed help/support articles. DB rows override matching slugs in '
  'lib/help.ts; slugs absent from DB fall back to the static constant.';

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_articles_admin_all" ON public.help_articles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "help_articles_public_read" ON public.help_articles
  FOR SELECT USING (is_published);

CREATE INDEX IF NOT EXISTS help_articles_topic_key_idx
  ON public.help_articles (topic_key, display_order);
