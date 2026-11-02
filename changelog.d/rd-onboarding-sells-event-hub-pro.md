## 2026-09-25 · feat(onboarding): Event Hub Pro joins Papic and Setnayan AI on the services step

Owner, verbatim: *"so now on the onboarding also, there are 3 things they can purchase
Papic, Setnayan AI, Event Hub Pro."* The shipped services step
(`app/onboarding/_shared/services-step.tsx`) gains a third card, built exactly like the
Setnayan AI card: a yes/no, off by default, its own line in the running total, minted
as one more line on the SAME onboarding bill (`ONBOARDING_SERVICES` + an
`onboarding_order_items` row for `COUPLE_WEBSITE_PRO`). It asks and never blocks.

- **Selection** (`lib/onboarding-services-selection.ts`): `hubPro` boolean, `setHubPro`,
  and both quotes carry its line. Parsing accepts only a genuine yes (`true` / `'true'`).
- **Card** (`lib/onboarding/services-step-data.ts` + `services-step-server.ts`): offered
  only when the type has the Event Hub (`surfaceEnabled(profile, 'website')`) AND the
  catalog prices `COUPLE_WEBSITE_PRO`; priced by the same `setupPricePhp` maps as the
  Papic rungs. Words are the existing Pro offer (`addOnHeroCopy('website-pro')`), split
  into a title and an `(i)` (`InfoTip`) — no new claims. Says "Event Hub", never "website".
- **Mint** (`lib/onboarding-services-orders.ts`): re-reads the event's stored type, prior
  ownership (owned or active ⇒ never billed twice; an unread ownership counts as owned)
  and the catalog price. Pure decision in `lib/onboarding-hub-pro.ts`.
- **Approval** (`lib/sku-activation.ts`): Pro is order-gated (its gates read the order
  and the basket live), so a Pro basket item no longer raises a false "no activation
  hook" fault.
- **/onboarding/simple**: its own hidden form field, `HUB_PRO_FIELD_SELECTED`.
- **Store shell**: the card rides on the same view as the planner card, which no mount
  builds in the App Store / Play Store shell (#5954). Pinned by a test.

## 2026-09-25 · feat(pricing): Event Hub Pro is ₱3,500 regular and ₱2,100 at sign-up

Owner: *"Regular Price is 3500 40% off when purchased on onboarding at 2100."* ·
*"so our regular price is 3500 to unlock pro"* · *"we will change every location of the
price of Event Hub Pro"*.

- Migration `20271245494068_event_hub_pro_is_3500_and_2100_at_sign_up.sql`:
  `COUPLE_WEBSITE_PRO` retail ₱3,500 (replacing the ₱2,000 of `20271245395425`) and its
  own `onboarding_price_php` ₱2,100 — the existing per-SKU sign-up price. The Papic and
  Setnayan AI family discounts and the house percentage are untouched. Reaches prod only
  through `deploy-prod`.
- Every Pro price surface already reads the catalog (`formatV2Sku` / the services-step
  reader / the order-charge authority); none carried a literal. New guard
  `lib/event-hub-pro-price-is-never-typed.test.ts` fails if a Pro figure is typed near Pro
  code in `app/` or `lib/`.
- `lib/llms-txt-guard-input.ts` follows the row (3500); a stale ₱4,999 comment in
  `lib/v2-catalog.ts` dropped.

SPEC IMPACT: Pricing + onboarding decisions already recorded in the corpus
`DECISION_LOG.md` (2026-09-25 rows "ONBOARDING SELLS THREE THINGS" and "EVENT HUB PRO:
REGULAR ₱3,500 · ₱2,100 AT ONBOARDING") by the Redesign Controller. ⚠ That row says
"Sai keeps 10%"; production reads Setnayan AI at 40% off at sign-up (₱2,499 → ₱1,499,
`ai_signup_discount_pct` 40), Papic's family at 30%, house floor 10% — flagged, not
edited here.
