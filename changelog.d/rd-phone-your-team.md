## 2026-10-01 · feat(suppliers): the phone Suppliers page (was Your Team) — booked suppliers first, one next step each, one Find a supplier

The approved phone design (owner 2026-10-01, `prototypes/phone_app_simple_2026-10-01_fable.html`
frame 4; DECISION_LOG "THE SIMPLE PHONE APP — APPROVED"), built by SIMPLIFYING the shipped
page at `app/dashboard/[eventId]/vendors` — nothing re-drawn, nothing removed:

- **Title + ⋯ · the team as rows · ONE "Find a supplier".** Each row: logo · name · service ·
  status pill · "Next: …" with at most one one-tap action — **Pay** (deposit card), **Lock** (the
  shipped `AccordionLockButton`, the one lock path), **Nudge** (opens the supplier's
  conversation — there is no nudge action and none was added), **Review** after the day.
  Booked first, then asked-to-lock, then deciding, then waiting for a quote.
- **Every state is an existing derivation** (`lib/your-team-rows.ts`, pure, executed):
  `lockRequestStateOf` (couple asks, supplier agrees), `depositStepOf` (a refused deposit read
  is a neutral "Check", never "Pay"), the bench card's own Lock verdict
  (`resolveBenchCardActions`), the review map, `SupplierStanding.needsYou`. No new read.
- **The category walls live inside Find a supplier.** Below lg the bench · Picks · Payments ·
  Plans are hidden until the button (or ⋯, or the bus, or a `?tab=`/`?open=`/`?inspect=` deep
  link) opens them — never unmounted. Desktop shows them below the team, as before.
- **Budget and the section jumps moved behind ⋯** — the section chips (a pill row) are now menu
  rows on the same `goToBuildTab` bus; Budget is the `yourTeamParts` link.
- **A refused read says "Couldn't load your suppliers"** (`lib/event-vendors-read.ts`), never
  an empty team — the throwing `fetchEventVendors` no longer reaches this page unmeasured.
- **Renamed "Suppliers"** on this page — page title, visible heading, tab title (owner 2026-10-01:
  the bar is Home · Guests · Suppliers · Hub · More). The bar/sidebar files belong to another PR.
- **The floating mobile team chip is retired** (`team-summary-chip.tsx` deleted, its mount in
  `build-locked.tsx` and the `html.teamchip-docked` shell padding removed) — owner 2026-10-01:
  nothing floats at the bottom of the phone. Its numbers now lead the page as the rows.
  `lib/team-summary-chip.test.ts` is now the retirement guard; port-control baseline regenerated.

Guards: `lib/your-team-rows.test.ts`, `lib/your-team-read-is-honest.test.ts`,
`app/dashboard/[eventId]/vendors/your-team-phone-first.test.ts`; `lib/pillar-parts.test.ts`
updated (Budget moved from the dropdown above the team to ⋯).

SPEC IMPACT: None.
