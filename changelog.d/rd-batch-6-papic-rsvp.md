## 2026-10-14 · release(guest): batch 6 — Papic easy buy/track/see + RSVP open and close

One release branch joining two finished draft PRs onto main a103decfda (#6528), merged `--no-ff` in order:
Papic #6529 (`rd/papic-easy` @9978b63f39 — Home's Papic row and next-card moments, the Papic page's top band with
Buy more / See N photos, credits everywhere, the guest camera told at zero, early "Your shots" before the day, the
guest bar Home · Details · ♡ Story · Camera · Gallery · Me) · RSVP #6530 (`rd/rsvp-open-close` @4606784ade — one
date for the Invitation, `replyWindow` with its own open and close in `rsvp_ask_config`, every reply door and writer
gated, Details › RSVP "Replies open / Replies close" rows). Each member's own fragment (`papic-easy.md`,
`rsvp-open-close.md`) carries the detail.

Conflicts, each resolved keeping both sides' intent:
- `lib/every-stage-is-todays-page.golden.json` — both members re-recorded it. #6529's record taken; all 28 cases
  dumped on #6529's head and on the joined tree and diffed: only `save_the_date.{guest,anonymous}.film` moved, and
  only "Arrives September 12, 2026" → "September 13, 2026" (#6530's intended 90-day Invitation date). Regenerated.
- `app/[slug]/_components/site-body.tsx`, `app/[slug]/page.tsx` — merged without conflict; disjoint hunks (#6529 the
  camera address + the early own-shots gallery, #6530 the reply-window gates), read and kept both.
- Regenerated, never hand-merged: `port-control-baseline.json`, `no-card.baseline.txt`.

Migration: #6529's seat backfill re-allocated forward with `pnpm migration:new` — `20271268379848` →
`20271269077780_papic_seats_take_the_six_month_default.sql` (batch 5's `20271268832636` had landed above it on main).
Pure data (one UPDATE on `paparazzi_seats`, idempotent), never applied anywhere. #6530 adds no migration.

SPEC IMPACT: None beyond the members' own (see their fragments; the corpus 📬 row's "On the day (default)" →
"On the event day" amendment is still owed, per #6530's handover).

Then the members' batch-6 walk fixes, merged `--no-ff` at their new heads: #6529 @b956a0e576 ("Later" never takes Buy
more away · the Papic page order · the run-out sentence said once over the viewfinder) and #6530 @ae4a566a76 (a join
request refused before replies open is told the Reply card's words and day · "Tap one to continue" never covers an
answer at 320 × 568, the reply-card golden carrying those two CSS rules). No conflicts; the stage golden and the
reply-card golden both pass on the join unchanged. Port-control baseline regenerated.
