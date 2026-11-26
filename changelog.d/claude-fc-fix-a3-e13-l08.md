## 2026-11-27 · fix(final check, area 3): a failed plan read decides nothing (L-08 rest, E-13 rest, owner Add 45)

The rest of A3·L-08 and A3·E-13, after #8357 and #8364. Owner ruling (Add 45): a failed plan read says "We couldn’t check your plan, try again." with a Try again press. It offers no upsell and no paid action, and no camera cap or free limit is drawn from it.

- **Plan reads:** the new `readPanoodTier` (lib/panood-camera-seats.ts) returns null when the read fails. `resolvePanoodTier` used to swallow that and say 'free', and it still does so for the server actions. Camera operators and the control room now read through `readPanoodTier`. On the control room, a failed read gets the plan line and a retry, and it no longer provisions the free 3-camera cap or draws the free overlay. `resolveAddOnState` now marks a refused orders read with `ordersUnread`, so on Live Watch the buy press gives way to the plan line.
- **Live setup:** when the active-broadcast read is refused, the page says "We couldn’t load whether you are live right now" with a retry and shows no Go live (`readActivePanoodBroadcast`, lib/panood-broadcast.ts). When the catalogue read fails, the Animated Monogram price reads "Couldn’t read the price" instead of "Price set in the Setnayan catalog" (`hubPartPrices` now returns `readFailed`).
- **Join-card print sheet:** a refused seat read is said, instead of listing every channel as waiting with "no join cards to print".
- **Memory lane (/live):** a refused screens read draws "—", not 0 screens. Refused screens or photos reads are said above the controls. A refused FaceBlock count is said instead of hiding the FaceBlock line, and the blur-ready count says "Couldn’t read" instead of a zero.
- **Live Watch:** when the catalogue read fails, the Pricing tile says "Couldn’t read".
- **Our story (E-13):** when the plan read fails, the page no longer says "trying Pro", states no free-story limit or count, and the plan line has a Try again.
- Guard: `lib/a-failed-plan-read-decides-nothing.test.ts`. No migration, no new server action, no price touched.

SPEC IMPACT: None. Honest-state fixes on shipped pages.
