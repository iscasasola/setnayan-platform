## 2026-11-06 · feat(open-shop): the approved sign-up redesign — four steps, account last, events all ticked, third pane, Today at three sizes

Builds the owner-approved supplier sign-up redesign (DECISION_LOG 2026-11-06 "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS
ANSWERED", "EVERY EVENT TYPE STARTS TICKED", "REDESIGN APPROVED"; prototype `prototypes/open_shop_redesign_2026-11-06/`)
on top of #7345 (A1–A10) and #7344 (B1–B3), which this branch contains and ships after.

- **Four steps in the new order** — 1 Name your shop · 2 What you do · 3 Where you are · 4 You + Open my shop. The logo,
  Position and "In business since" are off the door. Server refusals carry the new steps (contact/account → 4,
  location → 3, events → 2); `four-steps.test.ts` OWNS map retargeted.
- **`?as=coordinator`** opens step 2 on `COORDINATOR_TRADE_SERVICES` ("What you coordinate"), with "Not a coordinator?
  Search all services".
- **Events as small photo tiles** (`event-tiles.tsx`: the shipped `eventTypePhotoSrc` + `eventTypePlaceholderGradient`),
  three across at 390, every type ticked to start, Select all · Clear; "Pick at least one event." refused in the browser
  AND on the server (the silent `['wedding']` fallback is gone).
- **Your services, together (prototype v8, DECISION_LOG 2026-11-06 "SERVICES SIT TOGETHER…" + "THE PLAN METER COUNTS
  CATEGORIES AND SERVICES PER CATEGORY")**: once the main is picked, step 2 reads "Your services" — the main and every
  added service in one list above "Events you serve", each added one with its group, Remove, "Free until your first
  booking on Setnayan is done" ⓘ, and its own events ("✓ Same events as ‹main› · Change" → its own tiles, Select all ·
  Clear · Done, "Use the same events as ‹main›"). After each pick: "More in ‹group›" (the picker opened in that group)
  and "A different category". Under the list the meter: "N categories · M services — ‹plan› covers this — free until
  your first booking on Setnayan is done" and "Reception 3 · Accommodation 1" — a category is the tier-2 Category (the
  tree's branch / `tile_id`), the plan the first whose `TIER_CAPS` parentCategories × servicesPerLeaf hold the list
  (`lib/open-shop-more-services.ts`). "Add more later…" is said only before the pick. The server re-resolves every
  added key against the same filtered tree, refuses one with no event ("Pick at least one event for each added
  service."), never refuses one for the plan, and — when services were added — writes the main and each added one to
  `vendor_coverages` through `insertCoverage` before the profile patch.
- **Where you are**: the lookup-running overlay, a big "Is this your address?" card with the full address and a
  full-width "Yes, that's right" (portalled into the right column at ≥768), the denied-location line; the server now
  refuses a shop with no confirmed pin (`locationStepError`, the same rule the wizard runs).
- **Errors under their own box** (`lib/open-shop-error-field.ts` maps every shared sentence to its box, `aria-describedby`
  ties them) — no top banner; the phone box says "Use 9XX XXX XXXX, or your landline with its area code."
- **Stale build**: a page left open across a deploy turns the primary button into "Tap Reload to keep going", the draft
  (now with name + address) parked first (`use-stale-build.ts`, the same `/api/health` check as the site-wide bar).
- **Sign in** opens the ONE sign-in panel (`SignInHerePanel`, one login everywhere) in a new `pane` mode — the shipped
  `SidePanel`, wide on the right from 768px, the bottom sheet on a phone — via `<SignInHereLink pane>`; in place,
  `router.refresh()` keeps every typed field.
- **Phone first**: the Back / Continue bar sits at the bottom of the phone screen (as drawn), not under short steps.
- **Error colour**: every under-box error (and the refused-location line, the phone box's border) wears the
  prototype's warn colour (`--m-mulberry-deep`), ticked event tiles the action colour (`--m-cta`).
- **"Couldn't name that spot — type your city above"** is said only while the City box is empty.
- **Fee** as one line with ⓘ — the label is the sentence, the numbers are still `feeNotice` from the live schedule.
- **Desktop**: the step on the left, "Your shop at a glance" on the right (the confirm pane while a pin waits).
- **Today**: a step's ✓ is its own meter, full ("Your details · 5 of 6 in" is never ticked); "In business since" counts
  under Your details (a just-named shop sees "Name your shop" ✓); the prototype's step lines and badges; the Shop row
  says "{service} · no card yet" and drops "details x of y" while the checklist shows it; "Since 2021", the ordinal
  only on the anniversary itself (`todayMilestoneWord`); from 768px the open step is the shipped `SidePanel`.
- `TakenSignIn` uses #7344's `PasswordField` (the two PRs' merge left one raw password box).

SPEC IMPACT: None new — implements the three DECISION_LOG 2026-11-06 rows above as decided. The logo-gates-going-live
row is PR #7342, still open, so `basic-setup-gate.ts` is untouched here. Items not built (check-email Resend / Change
email, the phone Today as a sheet) are listed with reasons in the PR body for the owner. ⚠ The sign-up meter counts
tier-2 Categories × services per category (owner, v8); the shipped card gate in `vendor-dashboard/services/actions.ts`
counts `parentsOfKind` ("parents of the 10") and cards per `vendor_services.category` — a different unit, deliberately
NOT changed here (DECISION_LOG 2026-11-06 build flag; the hold build reconciles them).
