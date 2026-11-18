## 2026-11-18 · fix(onboarding): three type faults the full typecheck found (no visible change)

`create-location-picker` was missing its `MAX_EVENT_AREAS` import, the dates sheet's state did not admit the `months` mode, and the "Not sure yet" toggle had no `icon` (an empty element, so nothing is drawn).

SPEC IMPACT: None

## 2026-11-18 · fix(suppliers): the step row no longer fades its colour

House motion rule (18 Nov, `MOTION_STANDARD_2026-11-18.md`): animate transform and opacity only, named motions only. The new step row carried `transition-colors`; its colour now changes at once.

SPEC IMPACT: None

## 2026-11-18 · fix(onboarding): "Areas that fit" asks the one "shop is live" predicate

`readAreaSupplierCounts` re-typed `public_visibility = verified` instead of asking `isShopLive` (`lib/every-public-surface-asks-one-predicate.test.ts` was red). It now selects `SHOP_LIVE_COLUMNS` and filters with `isShopLive`.

SPEC IMPACT: None
