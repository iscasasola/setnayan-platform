## 2026-11-10 · feat(plan): the shared lock (Problem → Solution) + ONE plan sheet, two doors (Build 5 · Lane B, slice 1)

Owner-approved 10 Nov (settings full-screen prototype, Plans; HOUSE_TEMPLATES T30). Slice 1 of Lane B.

- **🔒 The shared lock** — `app/_components/lock/locked-feature.tsx` (`LockedFeature` row · `LockButton` · `LockExplainer`).
  A locked feature keeps its real name and a small 🔒; a tap rises full screen (the shipped `RiseScreen`) with the
  Problem, then the Solution, a view-only preview, the papers' progress or the price, and ONE button (Get verified /
  Upgrade; no Upgrade in the store shell). The lines live in ONE registry, `lib/locks.ts`, with `canUse(feature, shop)`
  as the one decision (verify locks lift the moment the shop is Verified; no plan lock opens before the papers).
- **📋 Door 2 — Plan › Change plan.** The bare "Your plan ▾" dropdown is replaced by plan rows that open in place
  (`subscription/_components/plan-sheet.tsx`): your plan first and open (each limit, the next payment), every other plan
  opening to What changes (each limit now → after, then what else changes) and What you pay (today, then each term) with
  its own Upgrade / Switch / Keep button. Limits from `TIER_CAPS`; today from `payToday` = the plan-change RPC's own
  arithmetic, with the unused value read from `vendor_unused_plan_value_php` (a failed read shows no number). An
  unverified shop sees every paid plan with the 🔒. Every rule the dropdown held stays (SKU-only Pay, too-short term,
  the gift's last week). `plan-picker.tsx` is gone.
- **⤴ Door 1 — past a plan limit.** `app/_components/lock/limit-sheet.tsx` + `limitAsk` (`lib/plan-sheet.ts`): "Upgrade
  to <lowest plan that allows it> to take up to <its limit> <thing>" + what else it unlocks + Upgrade / Keep <old>; the
  setting saves at the current limit until paid. Built and in the lab; NOT yet wired to the steppers (slice 2).
- Lab: `/dev/supplier-plan-lab?s=plan` (sheet) · `?s=lock&lock=<key>` · `?s=limit&tier=solo&key=bookingsPerDate&want=2`.
- Guards: `lib/plan-sheet.test.ts`, `app/_components/lock/every-lock-shows-problem-and-solution.test.ts` (incl. the
  UI-only list that can only shrink), `subscription/the-plan-is-rows.test.ts` updated to the rows.

SPEC IMPACT: None to rulings — builds the approved Lane B design. One lock's lines are a draft not in the corpus §11
table (the `plans` lock's Problem/Solution), flagged in the PR for the owner. Left for later slices: wiring each lock's
server gate (12 listed in the guard), Door 1 on the steppers, lock badges on `shop-makers.tsx`, Papers renewal 31 March.
