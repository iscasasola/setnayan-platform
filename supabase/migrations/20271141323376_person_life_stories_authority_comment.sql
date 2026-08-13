-- person life stories authority comment
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • COMMENT ON … is idempotent by construction (last writer wins).

-- ============================================================================
-- WHO ACTUALLY GATES PHASE 2 — a comment correction, nothing else. NO DDL, no
-- data, no policy change.
--
-- `20270515309755` shipped this table with a COMMENT saying it was
-- "counsel-gated … until PH counsel signs off". On 2026-08-13 the owner ruled
-- "allow it. unblock it." — which he is entitled to do: he is the registered
-- DPO (Indalecio Sacdalan Casasola II, NPC-registered 2026-07-07).
--
-- ⚖ THAT IS A DPO'S OWN DECISION, NOT A COUNSEL OPINION, AND THE DIFFERENCE
-- MATTERS. No external PH counsel opinion exists for Phase 2. Leaving the old
-- wording would let a future reader believe outside counsel had cleared this
-- and act on the stronger claim; replacing it with "counsel cleared" would be
-- the same lie in the other direction. So it says exactly what happened.
--
-- 🔑 WHY A NEW MIGRATION AND NOT AN EDIT. `20270515309755` is APPLIED, and
-- applied migrations are never edited — the false line would simply stay in the
-- file forever. What a reader actually queries is `obj_description()`, so the
-- correction has to be a new COMMENT. Same remedy the guest photo wall needed
-- when an applied migration misdescribed live_photo_wall_visibility.
--
-- ⚠ STILL TRUE AND NOT BEING RELAXED: the table is inert until the owner sets
-- NEXT_PUBLIC_PERSON_LIFE_STORIES=1 in Vercel; assembly is TAGS + QR +
-- CONFIRMED IDENTITY only (never cross-event face recognition); rows are
-- REFERENCES, never media copies; per-person hide never touches the host
-- gallery; opt-out / face-blur tombstone via removed_at; editorials need
-- consented_at; adults-first, with minors still Phase 3 and genuinely
-- counsel-gated.
-- ============================================================================

COMMENT ON TABLE public.person_story_items IS
  'Person-spine PHASE 2 life stories. GATE (corrected 2026-08-13): the ONE remaining condition is the owner setting NEXT_PUBLIC_PERSON_LIFE_STORIES=1 in Vercel; until then this table is empty and every read/write path is inert. The earlier "counsel-gated" wording is superseded — the owner discharged that condition himself as the NPC-registered DPO, and NO external PH counsel opinion exists for Phase 2 (do not read one into this). Minors remain Phase 3 and genuinely counsel-gated. Multi-homes a shared event photo/clip/editorial into a PARTICIPANT''s lifelong archive by REFERENCE (source_table+source_id into R2, never a copy). Assembled from TAGS+QR+CONFIRMED IDENTITY only (never cross-event face recognition). Per-person hide (hidden_at) never affects the host gallery; opt-out/face-blur tombstones via removed_at. Editorials require consented_at (host-publish + consented-guest gate). Adults-first.';

-- consented_at gained a SECOND job on 2026-08-13 and the old comment described
-- only the first. It is now the switch that decides whether a co-presence may
-- surface on somebody ELSE's public page ("the days you were both there"), so
-- it must never be stamped without a real yes.
COMMENT ON COLUMN public.person_story_items.consented_at IS
  'Consent stamp, with TWO jobs. (1) REQUIRED for editorial rows (the host-publish + consented-guest gate; enforced by the person_story_items_editorial_consented CHECK). (2) Since 2026-08-13 it is also the PUBLIC-SURFACING gate for photo/clip rows: the mutual "days you were both there" read requires it on BOTH people, so a row without it stays in that person''s own private archive and can never appear on anyone else''s page. Written by multiHomePapicItem ONLY when the tagged guest''s guests.photo_consent is exactly true — NULL means no, and NULL is the safe reading.';
