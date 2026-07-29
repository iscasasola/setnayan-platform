## 2026-07-29 · fix(explore): the disclosure that opens Payments no longer says "Show comparison" — and the Budget section is renamed to what it actually shows

PR-1 of `Explore_Integration_BUILD_SPEC_2026-07-29.md` §8. The XS half of the naming debt on `/dashboard/[eventId]/vendors`: three strings, no logic, trivially revertible. The owner's complaint was "your team, your budget, your plan … the page is not fully integrated properly."

**1. The live copy bug — one shared button, one wrong label.** `ServiceSection`'s disclosure was hardcoded `'Show comparison'` (`services-takeover.tsx`). `collapsible` is passed by **two** sections — Compare *and* Budget — so the button that opens the money section literally said "Show comparison". The heading already names the section, so the button only has to name the verb: now plain **"Show" / "Hide"**. Fixed **unconditionally**, not behind the replan flag — it is wrong on both paths (spec §5, "fix in the same stroke").

**2. `budget` → "Payments"** (flag-ON only, via `isExploreReplanEnabled()`). One word, one concept (spec §2): **budget** is the money *target* — the tile and `/dashboard/[eventId]/budget`, the canonical editor — while this section is the *payments lens*. It always was: `MerkadoBudgetLens` already leads with a "Payments" eyebrow, a paid/to-go progress bar and the next dues. The name was the only thing out of step. Three consumers move together so they cannot drift:
- `SECTION_HEADING.budget` (`services-takeover.tsx`) → **"Payments"**.
- `tabLabel('budget')` (`lib/budget-build.ts`) → **"Payments"**, which also carries the rename into the docked mobile sub-nav via `customer-menu.ts`.
- **NEW `tabBlurb(tab)`** beside `tabLabel` — a renamed section must not keep the old section's sentence. `budget`'s sub-heading becomes *"What's paid, what's due — and the doorway to your full budget."* Every other tab returns `TAB_META[tab].blurb` verbatim.

**3. `BuildCompare`'s inner `h2` "Plans" removed** (flag-ON only). It sat directly beneath the section heading "Your plans" — each section was naming itself twice (spec §2: *no card titles inside sections*). The descriptive `<p>` under it stays; it says something the heading doesn't. Flag-OFF the component keeps its own `<h2>Compare your plans</h2>` exactly as today.

**The kill-switch stays honest.** Every rename rides an existing `isExploreReplanEnabled()` branch, so `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=false` renders the page byte-identically to today — apart from the "Show" button, which is the bug fix. Tab KEYS are untouched (`'budget'`, `'compare'`), so `?tab=` deep links, the `BB_TAB_EVENT` bus, the `#svc-*` anchors and the `customer.budget-subnav.*` registry slots all keep working.

No migration, no DB write, no flag change. PR-2 (`claude/explore-team-merge`) carries the large half: the "Your team" merge and the quote-fill row.

SPEC IMPACT: None beyond the build spec that ordered it — `~/Documents/Claude/Projects/Setnayan/Explore_Integration_BUILD_SPEC_2026-07-29.md` §2, §5, §8 row 1. No SKU, price or schema change.
