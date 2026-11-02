## 2026-07-29 · fix(marketplace): "Find more" searches that category IN PLACE — the shipped overlay was never wired into the bench

Owner: *"also clicking find more doesn't search specifically for that category. and it jumps to a new page, it needs to stay on that page. this means, we need the best approach to show the best searches for that category."*

**Nothing new was built.** `CategorySearchOverlay` already exists and its own docblock states its job: *"the in-place full-page sheet that replaces the marketplace JUMP from the Vendors-tab 'Find / Add' buttons"* — hard-scoped, X upper-left, live as-you-type search, bottom-sheet Filter, and an Add that shortlists and **stays open** so the couple can keep browsing. It was mounted in exactly ONE place: `plan-budget-accordion.tsx`, the pre-takeover accordion. When the new bench was built, its rail-end card kept the old `/explore?tile=` `<Link>` and the overlay was never connected. That was the whole bug.

Both bench doorways — the rail-end card (**"Find more"** *and* **"＋ Add another X"**; slice D's `railEndIsAddAnother` is untouched, so which label shows is unchanged) and the empty-category **"Find {label}"** card — now open that sheet. The result order stays owner-locked (favorites → boosted → top-10 reviews → nearest), Add still reuses `saveVendorToPicks`, and the sheet still owns its focus trap, scroll lock and layered Escape via `useModalA11y`. At `z-index: 120` it covers the mobile bottom nav (`z-30`) and the section dock (`z-20`); its footer already pads for `env(safe-area-inset-bottom)`.

### The scope had to be resolved, not copied

The accordion is built from **plan groups** and just hands over a `groupId`. **The bench is built from tiles**, and the two do not line up. Passing "the tile's plan group" would have been wrong twice over:

- **Coverage.** Only **22 of the 69** wedding tiles are the `catalogTile` of any plan group. The other 47 — brides' attire, food carts, henna, event insurance — render as bench rows today, so a group-only bridge would have left the owner's complaint standing on two thirds of the surface.
- **Width.** For **13 of those 22** the group is far *narrower* than the row, because `subcategoryHint` collapses `canonicalsForGroup` to a single canonical service: "Coordinator" would search **1 of its 12** canonicals, "Catering" 1 of 5, "Hair & makeup" 1 of 6. A row showing a fraction of itself reads as a broken search — worse than the page jump.
- Two tiles are owned by **two** groups, the second narrower than the row: `reception` → `reception_venue` *and* `accommodation`; `ceremony_venue` → `ceremony_venue` *and* `officiant`. A row labelled "Reception" must not search hotels.

So `searchCategoryVendors` gained an **additive, optional `tile`** input and the scope resolver was renamed `canonicalsForScope`: **the tile decides what is searched** (it is the row the couple tapped — never wider, never narrower), while **`groupId` keeps carrying context the tile cannot** — the last-minute config key (`planning_deadlines.ref_key`) and the Budget-Planner allocation leaf. Both of those already fail open on a miss, which is why `groupId: ''` is safe for the 47. With no `tile` the group path is byte-identical, so the accordion call site is untouched. New resolver + its reasoning: `lib/bench-category-search.ts`.

68 of the 69 tiles resolve to at least one canonical service; `editorial` alone has none and falls through to its group, so no tile silently searches an empty scope.

### Add-and-stay now actually lands on the bench

**Today:** the sheet marks the row "✓ Added" and stays open (correct), but `saveVendorToPicks` revalidates `/dashboard/[eventId]` — the **overview** page, not this nested route — so nothing repaints the category rail. The vendor the couple just added would not appear until a hard reload.

**Now:** the overlay reports each successful add through a new optional `onAdded` callback; the bench sets a flag and does **one soft `router.refresh()` on close, only when something was added**. No refresh when the couple just browsed and backed out.

### Empty state — the state prod is actually in

Prod has **0 `vendor_services`**, so every category search returns nothing. The shipped copy said *"No X vendors match yet. Try a different search, or widen your filters"* — advice that is plainly wrong on a first open with no query and no filters, and reads as a broken screen. The empty branch now tells the truth for the state it is in: with a query or an active filter it keeps the original line; otherwise **"No {category} vendors here yet — we'll show them the moment they join Setnayan."** Same calm serif treatment, no void. Benefits the accordion call site too.

So on the owner's event, tapping "Find more" on Reception opens a sheet titled **Reception**, scope line *"Showing only reception vendors · 0 available"*, the honest empty line above, and the search + Filter footer — on the same page, with the bench still behind it.

### Flag

Flag OFF keeps the shipped `<Link href={t.exploreHref}>` navigation on both doorways, exactly as today; `exploreHref` stays on `ShortlistTile`. The `/explore?tile=` param itself was verified **not** broken — `/explore` reverse-maps the slug correctly — so this is about the experience of being thrown into another surface, not a filter bug.

`lib/bench-category-search.test.ts` — 11 assertions. Mutation-checked: reverting the rail-end card to `<Link href={t.exploreHref}>` turns *"the rail-end card opens the in-place sheet, it does NOT navigate away"* red.

Untouched: the doorway-anchor fix (`#sltile-*` + the bench's mount scroll), the `grid-template-columns: minmax(0,1fr)` accordion-overflow rule, the reduced-motion blocks, and the folder/leaf row icons.

SPEC IMPACT: None — no SKU, price, schema, entitlement or flag change. Connects a shipped component to a doorway that was left pointing at the old page jump.
