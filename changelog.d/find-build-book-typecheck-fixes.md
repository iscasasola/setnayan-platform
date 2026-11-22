## 2026-11-18 · fix(onboarding): three type faults the full typecheck found (no visible change)

`create-location-picker` was missing its `MAX_EVENT_AREAS` import, the dates sheet's state did not admit the `months` mode, and the "Not sure yet" toggle had no `icon` (an empty element, so nothing is drawn).

SPEC IMPACT: None

## 2026-11-18 · fix(suppliers): the step row no longer fades its colour

House motion rule (18 Nov, `MOTION_STANDARD_2026-11-18.md`): animate transform and opacity only, named motions only. The new step row carried `transition-colors`; its colour now changes at once.

SPEC IMPACT: None

## 2026-11-18 · fix(onboarding): "Areas that fit" asks the one "shop is live" predicate

`readAreaSupplierCounts` re-typed `public_visibility = verified` instead of asking `isShopLive` (`lib/every-public-surface-asks-one-predicate.test.ts` was red). It now selects `SHOP_LIVE_COLUMNS` and filters with `isShopLive`.

SPEC IMPACT: None

## 2026-11-21 · fix(suppliers): the asked line stays one short paragraph after the #8012 catch-up

The #8012 merge put its guarded "Booking requested…" line, an Undo comment and a `{' '}` inside one `<p>` in `accordion-lock.tsx`, so `lib/template-score-ratchet.test.ts` counted a new long paragraph (Suppliers 69 → 71, baseline 69). The comment moved above the `<p>` and the Undo's gap is `ml-1`. #8012's line is unchanged and nothing moves on screen.

SPEC IMPACT: None
