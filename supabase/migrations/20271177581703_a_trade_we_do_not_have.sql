-- A trade we do not have arrives ready to press (C4, 2026-08-28).
--
-- WHY THIS TABLE EXISTS
-- A supplier's words already land in `taxonomy_category_requests` — the intake,
-- the queue and all FOUR outcomes (promote · map · kept_private · rejected)
-- have shipped since 20260811000000. What the queue has never had is anything
-- that helps DECIDE. A request arrives as a bare label and a sentence, and the
-- one control that mints a permanent public category asks the admin to pick a
-- tile blind, out of 75.
--
-- This table holds a DRAFT of that decision, and nothing else: a cleaner name,
-- the branch we think it belongs under, and the near-matches we considered and
-- rejected with a reason for each. It is written by a model, once, at the
-- moment the supplier files the request.
--
-- ⛔ IT MINTS NOTHING, AND IT CANNOT. There is no path from this table to
-- `canonical_service_schemas` or `canonical_service_taxonomy`. A person opens
-- /admin/taxonomy and presses. Three measured reasons, from § 4 of
-- WHATS_NEXT_The_Category_Suggester_2026-08-28.md:
--   1. Removing a leaf later STRANDS the shops that declared coverage on it
--      (vendor_coverages.canonical_service carries no foreign key at all — see
--      lib/dangling-trade-keys.ts). Every mint is close to permanent.
--   2. `promoteCategoryRequest`'s duplicate check is a SLUG match, not a
--      meaning match — it would happily mint "Sorbetes Cart" beside the
--      existing "Ice Cream Cart", and a split trade is two half-empty
--      category pages plus suppliers who cannot find each other.
--   3. The owner's own standing rule (one-person admin plan, 2026-07-11): the
--      assistant may PREPARE and may HOLD BACK; it may never be the thing that
--      lets money, a price, an approval or a publish through. A public
--      category is a publish.
--
-- 🔒 A SUPPLIER CANNOT WRITE A ROW HERE, BY ABSENCE OF A POLICY. New tables in
-- this schema arrive with ALL privileges granted to `anon` and `authenticated`
-- by the schema's default ACL (measured in prod 2026-08-28), so RLS is the only
-- fence — and the only policy below is admin-only. Rows are written by the
-- service-role client from `proposeCategory`, keyed on a request_id THAT
-- ACTION'S OWN INSERT returned; never on an id posted by a browser. Without
-- this separation a signed-in supplier could POST a forged "the assistant
-- proposed this, under this branch" row through PostgREST and have the queue
-- present their own guess as ours — the eighth costume of "the row is yours,
-- the field is not".
--
-- 🔑 ONE ROW PER REQUEST, CASCADING WITH IT. The draft is an opinion ABOUT a
-- request; it has no life of its own, so `request_id` is both the primary key
-- and the foreign key. A deleted request takes its draft with it.
--
-- ⚖ SHIPS DARK. `CATEGORY_PROPOSAL_DRAFT_ENABLED` defaults OFF
-- (lib/category-proposal-flag.ts). Production holds ZERO category requests,
-- ever (measured by the object, 2026-08-28), so nothing is drafted for anybody
-- until the owner switches it on — and with the flag off this table simply
-- stays empty and every screen renders exactly as it does today.

CREATE TABLE IF NOT EXISTS public.taxonomy_category_request_drafts (
  -- The request this draft is about. PK and FK at once: one draft per request,
  -- and a deleted request cannot leave an orphaned opinion behind.
  request_id           uuid PRIMARY KEY
                       REFERENCES public.taxonomy_category_requests (request_id)
                       ON DELETE CASCADE,
  -- What the assistant thinks this trade should be CALLED — a cleaner name than
  -- the sentence a supplier typed ("Pet grooming for weddings" → "Pet
  -- Attendants"). A suggestion for a person to accept, edit or ignore; the
  -- promote control still submits whichever label the ADMIN leaves in the box.
  suggested_label      text NOT NULL
                       CONSTRAINT tcrd_suggested_label_len_chk
                       CHECK (char_length(btrim(suggested_label)) BETWEEN 2 AND 80),
  -- The tier-2 tile it would live under. NULL is a legal and honest answer:
  -- "we could not place this". SET NULL rather than CASCADE because a retired
  -- tile must not delete the rest of the draft.
  suggested_tile_id    text REFERENCES public.service_categories (id) ON DELETE SET NULL,
  -- One plain sentence: why that branch. Shown beside the tile picker with the
  -- caution that the branch is the weakest part of any draft.
  tile_reason          text CONSTRAINT tcrd_tile_reason_len_chk
                       CHECK (tile_reason IS NULL OR char_length(tile_reason) <= 400),
  -- 'new'      — we have no word for this; the draft proposes one.
  -- 'existing' — we think we ALREADY have this trade; `closest_existing` names
  --              it and the admin should Map, not Promote. This is the
  --              highest-value half of the feature: most "new" categories are
  --              an existing trade under another name.
  verdict              text NOT NULL DEFAULT 'new'
                       CONSTRAINT tcrd_verdict_chk CHECK (verdict IN ('new', 'existing')),
  -- Set only when verdict = 'existing'. NOT a foreign key on purpose: a trade
  -- can be merged away after this row is written, and the application resolves
  -- the key through lib/service-merge-forward.ts at READ time and drops it
  -- silently if it no longer names a visible trade — the same posture
  -- canonical_service_aliases takes. A hard FK would instead block the merge.
  closest_existing     text,
  -- The near-matches considered and REJECTED, each with one line saying why
  -- not: [{"canonical_service": "...", "label": "...", "why_not": "..."}].
  -- Rendered ABOVE the promote button, never below it — a queue with a
  -- suggestion attached is a queue people stop reading, and the whole point of
  -- the person in the middle is lost if the answer can be accepted without the
  -- alternatives having been read.
  near_matches         jsonb NOT NULL DEFAULT '[]'::jsonb
                       CONSTRAINT tcrd_near_matches_is_array_chk
                       CHECK (jsonb_typeof(near_matches) = 'array'),
  -- WHO wrote this draft, so a bad batch can be told apart from a good one:
  -- a model id ("claude-haiku-4-5"), or the literal 'lexical' when the live
  -- trade list answered it outright and NO model was called at all. The
  -- cheapest arm is also the most valuable one (§ 4 of the plan: most "new"
  -- categories are an existing trade under another name), so it must be
  -- visible on the row rather than inferred.
  drafted_by           text NOT NULL
                       CONSTRAINT tcrd_drafted_by_len_chk
                       CHECK (char_length(btrim(drafted_by)) BETWEEN 1 AND 60),
  drafted_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.taxonomy_category_request_drafts IS
  'A drafted proposal for one vendor category request: a cleaner name, the '
  'branch it might belong under, and the near-matches rejected with reasons. '
  'Written by a model at intake; MINTS NOTHING — a person presses Promote on '
  '/admin/taxonomy. Admin-read-only; written with the service role. C4, '
  '2026-08-28.';

COMMENT ON COLUMN public.taxonomy_category_request_drafts.verdict IS
  'new = we have no word for this | existing = we think closest_existing '
  'already is this trade, so Map rather than Promote.';

COMMENT ON COLUMN public.taxonomy_category_request_drafts.drafted_by IS
  'A model id, or the literal ''lexical'' when the shipped ranker answered it '
  'with no model call at all.';

COMMENT ON COLUMN public.taxonomy_category_request_drafts.closest_existing IS
  'A canonical_service key, deliberately WITHOUT a foreign key: resolved '
  'through the merge-forward map at read time and dropped silently if it no '
  'longer names a visible trade, so a merge is never blocked by a draft.';

-- The queue reads pending requests then joins their drafts; the tile index
-- answers "what has been proposed under this branch" for a reviewer.
CREATE INDEX IF NOT EXISTS taxonomy_category_request_drafts_tile_idx
  ON public.taxonomy_category_request_drafts (suggested_tile_id)
  WHERE suggested_tile_id IS NOT NULL;

-- RLS at CREATE TABLE time, per the house pattern.
ALTER TABLE public.taxonomy_category_request_drafts ENABLE ROW LEVEL SECURITY;

-- Admins only, for every verb. There is deliberately NO vendor policy: the
-- supplier who filed the request never sees our working notes about it, and —
-- more importantly — cannot write one. The service-role client used by
-- `proposeCategory` sits outside RLS entirely; this policy is the floor under
-- an ordinary authenticated session.
DROP POLICY IF EXISTS taxonomy_category_request_drafts_admin_all
  ON public.taxonomy_category_request_drafts;
CREATE POLICY taxonomy_category_request_drafts_admin_all
  ON public.taxonomy_category_request_drafts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Defence in depth, and the second lock rather than the only one: nothing
-- anonymous has any business here at all, and a table whose sole fence is one
-- RLS policy is one badly-written future policy away from a public key. See
-- tests/db/anon-table-grants-closed.db.test.ts for why a REVOKE alone is a
-- point-in-time act and must be re-asserted by a test.
REVOKE ALL ON public.taxonomy_category_request_drafts FROM anon;
