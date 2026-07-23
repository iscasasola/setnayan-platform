## 2026-07-23 · feat(website): open-browse inert schema — per-event switch + widget mode column

OPEN-BROWSE PR4 (council build plan §3 row 4,
`Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md`). One
migration (`20270919912384_open_browse_inert_schema.sql`, allocator-minted),
ZERO readers — fully inert at merge; under auto-apply-on-merge the DEFAULT
FALSE **is** the go-live hold:

1. `events.website_open_browse BOOLEAN NOT NULL DEFAULT FALSE` — the per-event
   open-browse master switch. Read by PR7 (render branch) + PR9 (board
   toggle); PR11 defaults NEW events ON at creation only. No backfill ever —
   in-flight weddings must not reshape overnight.
2. `invitation_widgets.mode TEXT NOT NULL DEFAULT 'auto'`
   `CHECK (mode IN ('auto','shown','hidden'))` + the load-bearing backfill IN
   THE SAME MIGRATION: `is_visible = FALSE AND is_always_on = FALSE → mode =
   'hidden'`, so the future flip can never un-hide a couple's deliberate choice
   — and the `is_always_on = FALSE` guard preserves the always-on invariant
   (hero/greeting/qr_card/rsvp render regardless of is_visible, so they must
   never become mode='hidden' once PR9 makes mode authoritative). Re-run-safe:
   the backfill only touches rows still at the 'auto' default.

New DB test `tests/db/open-browse-schema.db.test.ts` (7 cases, full-migration
replay): new-event default FALSE + NOT NULL · **the prod path** (ADD COLUMN
populates PRE-EXISTING events with FALSE, not NULL, via drop-and-re-ALTER on a
populated table) · mode defaults 'auto' · **seed is the full canonical 16
(gated** — the 20270919679722 reconcile is on the replay base) · backfill
converts hidden rows · **always-on guard** (a forced is_visible=FALSE always-on
row is never tagged hidden) · re-run guard preserves 'shown' · CHECK rejects
garbage. (Hardened after an adversarial pre-ship review of the migration.)

SPEC IMPACT: None — inert schema; corpus updates land with PR11 per the
council plan.
