-- handshake-tokens-consumed-defaults-to-zero (SUP-54)
--
-- `manpower_gigs.handshake_tokens_consumed` still DEFAULTed to 2, a leftover
-- from the pre-retirement token economy (migration 20260704020000). Vendor
-- token packs were retired 2026-07-21 and accepting a gig was made FREE
-- (migration 20270910266901 / 20270909586177) — `acceptManpowerGig`'s own
-- comment in apps/web/app/vendor-dashboard/manpower/actions.ts already says
-- "handshake_tokens_consumed stays at its 0 default", but nothing ever wrote
-- 0: `claim_manpower_gig()` (20271179151893) never touches the column and
-- `postManpowerGig`'s INSERT never sets it, so every posted gig silently
-- recorded the stale default of 2 — every ledger row for this free feature
-- was wrong by the DB's own comment.
--
-- Proved which side was true before picking a fix: the code path is the
-- correct behaviour (free-to-accept is a shipped, owner-ruled decision with
-- its own long comment and a changelog trail); the column default was never
-- updated when the token model was retired. So the DB write moves to match
-- the comment, not the other way around.

ALTER TABLE public.manpower_gigs
  ALTER COLUMN handshake_tokens_consumed SET DEFAULT 0;

COMMENT ON COLUMN public.manpower_gigs.handshake_tokens_consumed IS
  'Vendor token packs were retired 2026-07-21 and accepting a gig is FREE (see acceptManpowerGig in apps/web/app/vendor-dashboard/manpower/actions.ts) — this column defaults to 0 and postManpowerGig now writes 0 explicitly rather than relying on the column default. Left in place (not dropped) for the Phase F ledger shape; the pre-retirement value was 2 and is DORMANT, not deleted. No backfill: a pre-retirement row recording 2 may reflect tokens genuinely consumed under the old model, and this migration cannot tell the two cases apart — that is a separate, owner-scoped question.';
