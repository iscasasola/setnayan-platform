## 2026-11-13 · fix(plans): Event Ultra can be bought — a door from /pricing, /pricing/plan and the front door (RW-13)

Owner: *"We want events ultra to be purchasable now."* Before this, `EVENT_ULTRA` was live in the catalogue and its charge path worked (`readUltraUpgradeCharge`), but no screen opened a checkout for it.

- **The checkout:** the event's plan screen (`/dashboard/[eventId]/studio/website-pro`, Free · Plus · Pro · Ultra — from #7608) mounts the Ultra drawer. For an event that already paid Plus or Pro, the drawer quotes "You pay ₱X — the difference from your Event …" (#7601). Every figure is read from `platform_retail_catalog_v2`.
- **The doors** (new `lib/plan-buy-doors.ts` + `app/_components/marketing/plan-buy-cta.tsx`, reusing the service pages' "Add to an event" picker `AddToEvent` — nothing new designed):
  - `/pricing`: the Event Plus, Event Pro and Event Ultra rows each carry the door (`PriceRowShell` gains an optional `action`).
  - `/pricing/plan`: under the quiz, "Plans for your event" lists the three plans (prices read by `readOurPrices`) with the door.
  - The front door's three plan cards carry "Have an event? Sign in to get …".
  - Signed in, the picker lists your events still ahead, and each opens that event's plan screen at the plan's card (`?plan=ultra#plan-ultra` rings it). Signed out, the door signs you in and returns you to /pricing.
- iPhone app unchanged: /pricing, /pricing/plan and the website-pro screen stay refused in the store shell (`lib/store-shell.ts`), and IAP keeps its refusal for an event that already paid toward a plan.
- New guard `lib/every-plan-has-a-checkout-door.test.ts`: every plan in `PLAN_PRICE_CODES` must have a checkout drawer, on the screen the doors open, and a door on /pricing and /pricing/plan. Sabotage-checked: removing the Ultra drawer, or the /pricing Ultra door, turns it red.
- No new server action, no migration.

SPEC IMPACT: None — makes an approved plan (DECISION_LOG 2026-11-13 "EVENT ULTRA APPROVED") purchasable through the existing plan screen.
