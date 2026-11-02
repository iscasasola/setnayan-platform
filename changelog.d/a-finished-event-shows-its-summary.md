## 2026-08-21 · feat(dashboard): a finished event shows its summary — and the editorial maker finally has a door

Owner, opening a Movie Night the morning after it happened: *"movie night event is already done. when i click it, how do i see what the editorial maker? why can i still plan and build and create guest list as if it hasn't ended. what we want is to show the summary of the overview, guest, marketplace, suite, and the editorial maker?"*

**Three separate things were true, and only one of them was a missing feature.**

### 1 · The After phase existed — on the phone only

`getMenuLifecyclePhase` has resolved **plan → dayof → after** since 2026-06-16, and `lib/customer-menu.ts` has carried an After roster (Overview · Review · Editorial · Galleries) for just as long. But `phase` reached only three consumers — the bottom nav, the nav FAB and the docked sub-nav — **all three of which are the phone's chrome**. `buildCustomerNavGroups`, the SSOT the desktop rail reads, never took the argument at all.

So on a laptop, a celebration that finished last month still led with a section headed **"Plan"**, and the Overview body still led with "74% planned". The After phase was not broken; it had simply never been wired to the wider of the two screens.

🔑 **A ROSTER THAT SWAPS ON ONE SURFACE AND NOT THE OTHER IS NOT A ROSTER THAT SWAPS.** Both now read one builder, and a test compares the rail's After destinations against the phone's rather than trusting that two hand-typed lists agree.

### 2 · The editorial maker had no door in any menu

`/dashboard/[eventId]/website/editorial` has shipped since iteration 0046. The only ways in were the Suite's "Your Website" card (via a chip) and the `/website` hub. It appears in the phone's After roster and **in no desktop menu at any phase** — which is exactly what *"how do i see the editorial maker?"* was asking.

It is now a rail row in the After phase, beside Galleries, and the accent card on the new summary. **Nothing was drawn** — the route, the editor and the phone's entry all already shipped.

### 3 · The Overview body had no After state at all

The day-of takeover already does the right move: on the day, the planning stack **recedes** behind *"Planning tools — still here if you need them"* and a grid of what matters now leads the page. After the day, nothing receded. `event-dashboard.tsx` has one phase branch and it is `dayOfActive`.

**New: `FinishedEventSummary`** — six cards in the same shape as the day-of grid, covering exactly what the owner named: **Overview · Guests · Marketplace · Suite · Galleries · the editorial maker**, the last carrying the accent because it is the only work still waiting.

🔒 **RECEDED, NOT REMOVED — and asserted, not promised.** A host still adding the cousin who turned up unannounced, or still settling a supplier's balance, opens one disclosure and has every tool where it was; every rail row stays and two JOIN them. A test walks the plan-phase rail and fails if the After rail dropped any of it.

### A count that could not be read is not zero

`lib/after-summary.ts` types every figure as `number | null`, null meaning **NOT MEASURED**, and each card prints no figure rather than a 0 it never measured. Supabase does not throw on a refused query — it resolves with `{ error }` — so `count ?? 0` reports a confident zero for a read that never happened, and "0 guests" on a wedding with 300 of them is a summary that lies while looking completely fine. Same family as the admin work list's `count === null` trap (2026-08-05).

**Zero itself is honest and IS shown.** Prod is pre-launch; this very event has 0 guests and 0 suppliers, and that is the plan, not a defect — so the card says so in words instead of hiding.

### And the menu was reading a different clock from the page

`layout.tsx` resolved the phase with **no timezone** — the runtime's own midnight, UTC on Vercel — while the Overview body has passed the venue's zone since 2026-08-14. Eight hours apart for a Manila event: the rail could flip to After while the page it points at still said day-of, or the reverse. Same wall-clock-vs-instant family as the 17 defects fixed on 2026-08-04. One resolver, one set of constants, and the bounds are **not restated** anywhere new.

### Also: the wrap-up screen told a Movie Night that its wedding was wrapped

`/clearance` was written when weddings were the only event type and greeted every other type with *"Your wedding day is wrapped."* It now routes through the shipped `eventNoun` resolver, and its copy says where the app actually goes next (the summary and the editorial maker) rather than naming an internal mode.

### What was deliberately NOT changed

- **The After boundary.** `after` still arrives either when the host presses **Close out the day**, or automatically once the day-of window has fully passed. No new threshold was invented, and the day-of window's constants are untouched.
- **The day-of takeover**, which is owner-signed-off and already correct.
- **Editorial in the rail before the event.** There is nothing to write yet; the wrap-up screen names where it lives.

### Verification

- 7 new assertions, **every one mutation-checked by occurrence count**, sabotage applied and measured before → after, all RED: editorial row 2→0 · `items: [...planItems, ...afterItems]` 1→0 · phase default 2→0 · href drift 2→1 · `if (error) return null;` 2→1 · `<EventDashboard` 7→6 · layout `timezone` 3→2. Baseline green before and after.
- Full unit suite **9101 pass / 0 fail**. Typecheck clean. `next lint` clean. Twelve lint guards incl. `lint:port-controls` and `lint:botnav` clean.
- Every column and enum label the new loader names was **verified to exist in production** before writing the query — the phantom-column / phantom-enum family gets the query REJECTED, not thrown, and ships as a silently empty card.

SPEC IMPACT: None — no SKU, price, schema or migration. Existing routes and phases only; the lifecycle model itself is unchanged.
