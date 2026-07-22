## 2026-07-22 · feat(papic-games): Phase 4b — vendor authoring + couple approval UI

The two UI surfaces for the custom vendor challenge (spec §3.4 / §3.6), wiring the
Phase 4a RPCs onto the vendor client card and the couple's Papic studio. Both are
async **server components** that self-fetch their own data (no host-page data-load
change) and self-gate on `papicGamesEnabled()` (`NEXT_PUBLIC_PAPIC_GAMES_V1`, OFF).

- **Vendor authoring** — `vendor-dashboard/clients/[eventId]/_components/vendor-challenge-section.tsx`
  mounted after `BoothPosterCard` (booked-only). Lists the vendor's own challenges
  with status (pending/live/rejected) + completion counts, and — for a **paid
  Pro-and-up** vendor (`resolveVendorTier` ∈ pro/enterprise/custom) — a compose
  form → `createVendorChallengeAction` (mirrors `suggestScheduleChange`: the RPC is
  the authoritative gate). Below Pro, an upsell instead of a compose box.
- **Couple approval** — `dashboard/[eventId]/studio/papic/vendor-challenges-approval.tsx`
  mounted after the Moderation section. Self-fetches pending vendor missions (couple
  reads `papic_missions` via the Phase-1 RLS policy), one Approve / Decline pair per
  row → `reviewVendorChallengeAction` (couple-guarded by `getCoupleEventId` **and**
  the RPC's own couple check). Hides entirely when there's nothing to review.
- **Actions** — `createVendorChallengeAction` (vendor) + `reviewVendorChallengeAction`
  (couple), both flag-guarded via the wrappers. The RPCs are the authoritative gate;
  the review action does NOT reuse the couple-only `getCoupleEventId` (so it admits
  the coordinators the panel is visible to, and avoids a storage-scoped error), and
  both `revalidatePath` + redirect plainly (feedback is the revalidated list/panel).

Adversarial review: 3 confirmed lows, all fixed — primary `SubmitButton`s were
unstyled (added mulberry classNames), redirect status hints weren't read by either
page (dropped them), and `getCoupleEventId` reuse blocked coordinators + leaked a
`storage_error` (replaced with RPC-authoritative gating). `tsc --noEmit` clean on
all touched files; pure tests 6/6.

SPEC IMPACT: None — implements Phase 4b (the UI for the 4a data layer). Deferred
(noted): a couple notification on new vendor challenges needs a new
`NotificationType` (the couple sees pending challenges on their Papic page for
now); showing the authoring vendor's name on the approval card. Phase 5 = the
vendor completion surface (DPO-gated photo delivery) + the leaderboard (§5#4).
