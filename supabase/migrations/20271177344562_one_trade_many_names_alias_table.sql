-- One trade, many names — the alias list (C2, 2026-08-28).
--
-- WHY THIS TABLE EXISTS
-- A supplier says "sorbetes", "sorbetero" or "ice cream cart" and none of
-- those words is guaranteed to appear inside the trade's own label
-- ("Sorbetes Cart") — the lexical ranker in lib/taxonomy-search-rank.ts
-- matches letters, not meaning. This table is the cheap fix: a phrase, the
-- trade it means, who wrote it, and whether a PERSON has reviewed it.
--
-- ⚖ WHY NOT EMBEDDINGS — see WHATS_NEXT_The_Category_Suggester_2026-08-28.md
-- § R. The evidence for embeddings beating prompting is a SUPERVISED
-- classifier trained on labelled history; production holds ZERO
-- supplier-authored service cards, so there is nothing to train on. The
-- already-chosen embedding model is English-only for a feature whose whole
-- point is Filipino/Taglish trade words. And the PGlite replay rewrites
-- extensions.vector(N) -> text, so a db test about it would be vacuous by
-- construction. An alias list does the same job at this project's size.
--
-- WHO WRITES A ROW
-- An offline script (`scripts/seed-trade-aliases.ts`), run by an admin, asks
-- Claude for synonyms per trade and inserts them UNREVIEWED
-- (reviewed_at IS NULL, written_by='ai'). Supplier text never enters this
-- path — the script reads the taxonomy and writes synonyms; nothing a
-- supplier typed is ever sent anywhere. That is why this slice needs no new
-- data processor and no privacy-notice change. An admin may also type one by
-- hand (written_by='admin'), which is reviewed by the same act of writing it.
--
-- 🔒 AN UNREVIEWED ALIAS MUST ANSWER NOBODY. The read policy below enforces
-- this at the RLS layer (unreviewed rows are invisible to anon/authenticated
-- outright), and the application re-checks it — the same belt-and-braces
-- posture `isKnownAdminHref` uses for a model's answer: never trust a single
-- layer to hold alone.
--
-- 🔑 THE STORED TRADE IS NOT TRUSTED FROM HERE. A trade can be merged into
-- another after this row is written (merge_canonical_service tombstones the
-- old key rather than deleting it — see service-merge-forward.ts). The
-- application resolves canonical_service through that forward map AT READ
-- TIME and drops the alias silently if the resolved key is not a currently
-- VISIBLE trade — never renders a stale or retired trade to a supplier.

CREATE TABLE IF NOT EXISTS public.canonical_service_aliases (
  id                 bigserial PRIMARY KEY,
  -- The words a supplier or the model used, normalised (lowercased, collapsed
  -- whitespace) — same normalisation on the way in and the way out, or a
  -- lookup never hits. Reuses lib/admin-map/ask-the-admin.ts's
  -- normalisePhrase; do not invent a second normaliser.
  phrase             text NOT NULL,
  -- The trade this phrase means. NOT trusted to still be the live key at
  -- read time — see service-merge-forward.ts. RESTRICT: a taxonomy row must
  -- outlive any alias naming it (merges tombstone rather than delete, so
  -- this almost never fires in practice).
  canonical_service  text NOT NULL
    REFERENCES public.canonical_service_taxonomy (canonical_service)
    ON DELETE RESTRICT,
  -- 'ai' = the offline seeding script; 'admin' = typed by hand.
  written_by         text NOT NULL DEFAULT 'ai',
  -- NULL = not yet reviewed, answers nobody. Set once a person confirms it.
  reviewed_at        timestamptz,
  reviewed_by        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_service_aliases_phrase_key UNIQUE (phrase),
  CONSTRAINT canonical_service_aliases_written_by_chk
    CHECK (written_by IN ('ai', 'admin')),
  CONSTRAINT canonical_service_aliases_phrase_len_chk
    CHECK (char_length(phrase) BETWEEN 2 AND 80),
  -- A reviewer must be on record whenever a row is marked reviewed — an
  -- alias nobody can be asked about is not a reviewed one.
  CONSTRAINT canonical_service_aliases_review_pair_chk
    CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL))
);

COMMENT ON TABLE public.canonical_service_aliases IS
  'One trade, many names: a phrase a supplier might type and the live '
  'canonical_service it means. Unreviewed rows (reviewed_at IS NULL) answer '
  'nobody. Resolved through the merge-forward map at read time, never '
  'trusted to still name a live trade. See C2, 2026-08-28.';

CREATE INDEX IF NOT EXISTS canonical_service_aliases_trade_idx
  ON public.canonical_service_aliases (canonical_service);
CREATE INDEX IF NOT EXISTS canonical_service_aliases_unreviewed_idx
  ON public.canonical_service_aliases (canonical_service)
  WHERE reviewed_at IS NULL;

-- RLS at CREATE TABLE time, per the house pattern.
ALTER TABLE public.canonical_service_aliases ENABLE ROW LEVEL SECURITY;

-- Public read, REVIEWED ROWS ONLY — mirrors canonical_service_taxonomy's own
-- "public SELECT" posture (this is taxonomy metadata, not anything a
-- supplier typed), narrowed by the one condition that matters: an
-- unreviewed row is invisible to anon/authenticated outright, not merely
-- filtered by app code that could be edited away.
DROP POLICY IF EXISTS canonical_service_aliases_read_reviewed
  ON public.canonical_service_aliases;
CREATE POLICY canonical_service_aliases_read_reviewed
  ON public.canonical_service_aliases FOR SELECT
  TO anon, authenticated
  USING (reviewed_at IS NOT NULL);

-- Admin write only — the same shape as every other taxonomy-admin table in
-- this schema (canonical_service_taxonomy_admin_write, service_categories_
-- admin_write). The seeding script and the review screen both run on the
-- admin (service-role) client, which sits outside RLS entirely; this policy
-- is the floor under an ordinary authenticated admin session too.
DROP POLICY IF EXISTS canonical_service_aliases_admin_write
  ON public.canonical_service_aliases;
CREATE POLICY canonical_service_aliases_admin_write
  ON public.canonical_service_aliases FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
