## 2026-10-26 · fix(app): one StayForm — a save never resets the screen (Papic · Memories · Moderation · Schedule · Sponsors) + a ratchet

- **"same to the rest of the website. avoid resetting the whole screen"** (owner, 2026-10-26). The Papic pattern from
  #6970 is now ONE app-wide shape: `app/_components/stay-form.tsx` (`StayForm`, `useStaySubmit`) posts a door NAME
  (`lib/stay-doors.ts`) to `app/_actions/save-in-place.ts`, whose registry (`Record<StayDoor, …>`) alone maps it to an
  action; the same action runs (its own sign-in / membership / gates) and its redirect is read by `lib/save-in-place.ts`
  in the area's own words — saved → re-rendered in place; refused → said on the row; signed out / not on the event /
  off the screen → navigates as before. The plain action stays as the no-JavaScript path. `ConfirmForm` takes `door`.
  Papic's `PapicStayForm` / `in-place-actions.ts` are folded into it (no behaviour change).
- Converted: Memories' photo sheet (hide / show · seat photo · approve · report · stop / let shoot · delete forever ·
  a supplier's photos) — the sheet follows the fresh list, so it stays open and flips; Papic › Moderation (the same
  nine controls); Event Details › a supplier's photos switch; Papic › Run of show (pause · arm · clear · add
  challenge); Schedule › your host's segments (tick · add to timeline); Sponsors (add · edit · invite · remove ·
  marked yes / declined — the sheet closes on a save).
- Deleted 9 redirecting actions with no caller (reload audit §3c): `updateGuestGroup`, `deleteGuestGroup`,
  `logPayment`, `provisionPapicSeats`, `reissuePapicSeat`, `updateVendorService`, `setServiceLinks`,
  `addServiceTimeSlot`, `deleteServiceTimeSlot`. Their guards were re-pointed at the live path, not weakened:
  `a-save-must-prove-it-wrote` → `commitVendorService` + `save_vendor_service`'s zero-row refusal;
  `you-are-told-when-you-are-paid`, `a-promote-has-a-precondition`, `payment-proof-public-bucket`,
  `payment-proof-ref-tenancy` → `/pay/<reference>` › `submitPaymentProof`; `order-price-authority` export list.
  Kept on purpose: the three retired camera sales, which REFUSE with a sentence (`papic-sells-only-credits.test.ts`).
- Ratchet: `lib/a-save-never-resets-the-screen.test.ts` (scanner `lib/stay-ratchet.ts`) — every redirecting server
  action is a door, navigation with a reason (`lib/stay-ratchet.navigation.ts`, seeded from the audit's 69), or in
  `lib/a-save-never-resets-the-screen.baseline.txt`, which may only shrink (`pnpm tsx lib/stay-ratchet.ts --write`);
  a door action posted by a bare `<form>` fails too.
- The shared door asks the limited-helper gate first (`limitedHelperRefusal(event_id, area)` — photos · schedule ·
  none for Sponsors, matching `AREA_RULES`), carried from #6970's door. `lib/ugat/scan-fields.ts` reads `<StayForm>`
  as a form (its `event_id` is the door's), so the Fields map and the create-form round trips see the in-place forms.

SPEC IMPACT: None to the spec text — implements DECISION_LOG 2026-10-26 "A SAVE NEVER RESETS THE SCREEN — APP-WIDE"
(first batch after the Papic template; the row already says the fixes land in batches and a repo guard follows).
