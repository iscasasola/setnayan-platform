## 2026-07-17 · feat(creator): user-home "your creator benefits" block (active collabs + performance, gated)

Adds a "Your creator benefits" block to the `/dashboard` launcher home for
storytellers who ALREADY hold active vendor collabs — owner req #6 in
`Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md`, un-deferred from the
simplest-approach council verdict §2 item 7 (which cut it from V1 behind a
≥20-active-collabs PLATFORM threshold) with a clean PER-USER gate: the block
renders only once THIS user holds ≥1 accepted `vendor_creator_offers` collab.

Two deterministic parts (Setnayan-AI Rule 1 — no LLM, no per-call cost):
- (a) **Active vendor offers** — the accepted collabs the user holds as the
  creator (vendor logo/name + the creator-rate terms they were offered), read
  RLS-scoped via a new `fetchActiveCreatorCollabs` in `lib/creator-offers.ts`.
  Links to the offers inbox (`/dashboard/creator#offers`).
- (b) **Performance for vendors** — the SAME reach numbers the `/u` profile
  shows (followers · views · inquiries driven), reusing
  `fetchCreatorInquiriesDriven` from `lib/inquiry-attribution.ts` (no refork).

Below the gate the block returns null — the "Become a Storyteller" promo (#3331)
already covers non-creators. Copy is worded "offers"/"benefits", NEVER
"earnings" (these are off-platform discounts, never cash from Setnayan). Content
suggestions / coaching are NOT built (permanently cut by the council). No
migration — reads existing tables. Self-fetching + null-returning so the
launcher pays one lean query for the 99% of users with no collab.

Files: `apps/web/app/dashboard/(launcher)/_components/creator-benefits.tsx`
(new) · `apps/web/app/dashboard/(launcher)/page.tsx` (wire into the bento right
column) · `apps/web/lib/creator-offers.ts` (`fetchActiveCreatorCollabs` +
`ActiveCreatorCollab`).

SPEC IMPACT: Documents the un-deferral of plan item #6 (user-home creator
benefits block) — logged as a `DECISION_LOG.md` row in the corpus. No SKU,
schema, or pricing change.
