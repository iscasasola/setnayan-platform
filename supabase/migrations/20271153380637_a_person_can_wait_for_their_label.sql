-- ============================================================================
-- a_person_can_wait_for_their_label
--
-- ── WHY ────────────────────────────────────────────────────────────────────
-- Owner, 2026-08-21, on the People page: *"creating connection to them should be
-- after they become connected to you. just add them first. Then you can set a
-- label. or a samahan, just like the guest list."*
--
-- The guest list works because adding is one line and everything else is a chip
-- you set afterwards. `person_connections` could not express that: `relation`
-- and `layer` are NOT NULL, so the very first thing the product had to ask was
-- "is this your spouse, your parent or your sibling?" — about somebody who is
-- not on the page yet and has not agreed to anything.
--
-- This makes the LABEL a later step:
--
--     relation IS NULL   they are on your list · you have not said what they are
--     relation = '…'     you have said · kinship derives from confirmed edges
--
-- ── WHY THE CHECKS BECOME "NULL OR ONE OF" ─────────────────────────────────
-- A CHECK comparing a NULL column to a list yields NULL, which Postgres accepts
-- — so `relation = ANY(...)` would already have admitted NULL once the NOT NULL
-- went. The constraints are rewritten explicitly anyway, because a reader has to
-- be able to see that NULL is INTENDED here rather than a hole somebody left.
--
-- ── THE UNIQUE INDEX THAT WOULD NOT HAVE HELD ──────────────────────────────
-- `person_connections_edge_uniq` is (from, to, relation) — and in a unique index
-- two NULLs are DISTINCT. So the moment relation may be NULL, "add Maria" twice
-- writes Maria into your list twice and the roster shows her twice. The partial
-- index below closes exactly that hole and nothing else: at most ONE unlabelled
-- edge per pair. Labelled edges keep their existing rule (a person can be both a
-- tito and a ninong — that is real, and it is not this index's business).
--
-- ── declared_name ──────────────────────────────────────────────────────────
-- The name the ADDER typed. Until the other person confirms, the name-visibility
-- rule deliberately refuses to resolve their real display name to the declarer
-- (2026-07-05), so without this the roster can only render "Pending" where a
-- person should be — which is precisely the list the owner asked to see
-- populated. It is the adder's own note about somebody who already holds an
-- account, never a record about a stranger: the pilot guardrail
-- (`kin_pilot_mutual_accounts`) still refuses any edge whose endpoints are not
-- both claimed accounts, and this migration does not touch it.
--
-- IDEMPOTENT: ALTER … DROP NOT NULL, ADD COLUMN IF NOT EXISTS, DROP/ADD
-- CONSTRAINT by name, CREATE INDEX IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.person_connections ALTER COLUMN relation DROP NOT NULL;
ALTER TABLE public.person_connections ALTER COLUMN layer    DROP NOT NULL;

ALTER TABLE public.person_connections
  ADD COLUMN IF NOT EXISTS declared_name TEXT;

ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_relation_check;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_relation_check CHECK (
    relation IS NULL
    OR relation = ANY (ARRAY['spouse','parent','child','sibling','godparent','godchild','friend'])
  );

ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_layer_check;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_layer_check CHECK (
    layer IS NULL
    OR layer = ANY (ARRAY['family','ritual','friend'])
  );

-- A label and its layer travel together or not at all. Without this, an edge can
-- carry a family layer and no relation (or the reverse), and every reader has to
-- invent a rule for the half-state.
ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_label_pair_chk;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_label_pair_chk CHECK (
    (relation IS NULL AND layer IS NULL) OR (relation IS NOT NULL AND layer IS NOT NULL)
  );

-- One unlabelled edge per pair. See the note above: NULLs are distinct in a
-- unique index, so `person_connections_edge_uniq` cannot do this job.
CREATE UNIQUE INDEX IF NOT EXISTS person_connections_unlabelled_uniq
  ON public.person_connections (from_person_id, to_person_id)
  WHERE relation IS NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.person_connections.relation IS
  'What to_person IS to from_person. NULL = on the list, not yet labelled (owner 2026-08-21: add first, label after). Family first-degree only; extended kin derived. Kinship derivation reads CONFIRMED and LABELLED edges only — an unlabelled edge produces no kin.';
COMMENT ON COLUMN public.person_connections.layer IS
  'family | ritual | friend, derived from relation and travelling with it: NULL exactly when relation is NULL (person_connections_label_pair_chk).';
COMMENT ON COLUMN public.person_connections.declared_name IS
  'The name the DECLARER typed when adding this person. Renders their row while the claim is unanswered, because visible_connection_names deliberately does not resolve a real display name to the declarer before confirmation (2026-07-05). Both endpoints are claimed accounts — kin_pilot_mutual_accounts still enforces that.';
