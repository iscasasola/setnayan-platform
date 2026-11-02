## 2026-08-25 · fix(loading): an audit of yesterday's skeleton sweep found a regression it caused, and the blind spot that hid it

An adversarial audit of PR #4833 — five independent lenses, every candidate then attacked by two skeptics told to refute it — was run against the merged change. **It found a real regression that PR introduced, plus the guard asymmetry that let it ship green.** This fixes both and corrects four published numbers.

### The regression, and it is the interesting kind

🚨 **`/admin/pricing` lost a correct button reservation without its file changing.** `TablePageSkeleton` used to hardcode `<HeaderSkeleton actions={1} />`. #4833 flipped that default to `0`. `app/admin/pricing/loading.tsx` is a bare `export { TablePageSkeleton as default }` and **was not in the merge diff** — its behaviour changed anyway. That page's **default** tab renders an unconditional *Download legacy catalog report* button in its masthead, so on every plain load a 44px control now dropped in out of nowhere: the same defect the sweep existed to remove, reintroduced by the fix, on a page nobody edited.

🔑 **WHY NO GUARD SAW IT — AN ASYMMETRY INSIDE ONE FILE, TWENTY LINES APART.** `drawsAHeading()` recursed four levels through imports. `mastheadActions()` did `src(pageFile)` and stopped. `/admin/pricing` has **no `<PageMasthead>` of its own** — its masthead lives in the tab surface it imports — so the rule concluded *"this page has no header buttons"* and **both halves went silent**: it neither demanded a reservation nor flagged a phantom one. Measured: 4 routes delegate their masthead this way.

⚠ **AND THE AUDIT'S OWN LIST WAS SHORT BY ONE.** It named three affected admin routes; re-deriving the list from the code found **four** (`admin/studio` too). *A hand-enumerated list is a list of the things you thought of* — including when an auditor writes it.

### The second one: right on a laptop, wrong on a phone

🚨 **`/dashboard/[eventId]/guests` reserved two 44px pills at every width.** Its two header links sit inside a `hidden … lg:flex` shell, so a phone never sees them. The loader was never touched by #4833 and kept its `actions={2}`. **#4833's own write-up claimed this page "deliberately reserves none" — it described a decision that was never made.**

The old guard **exempted** this case in both directions, reasoning that one skeleton cannot be right about both widths. That was the wrong answer to a real problem: `HeaderSkeleton` now takes **`actionsAt: 'always' | 'lg'`**, so the reservation follows the buttons and **the exemption is deleted rather than kept**.

### What changed

- `HeaderSkeleton` + all eight templates take and forward `actionsAt`.
- `app/admin/pricing/loading.tsx` reserves its button again, with the trap written into the file so the next default flip cannot silently undo it.
- `app/dashboard/[eventId]/guests/loading.tsx` reserves its two buttons **from `lg` up only**.
- ⛔ **`admin/studio`, `admin/accounts` and `admin/app-performance` are deliberately NOT given a reservation.** Their **default** tabs draw no button — reserving one would put phantom chrome on the common load to fix a rarer one. Only `/admin/pricing`'s default tab has an unconditional button.

### The guard, four ways stronger

1. **`mastheadActions()` follows the delegation the app actually uses.** Measured: 10 routes hold their masthead in `page.tsx`, 4 delegate to a `_surfaces/*` tab surface, **zero** use any other shape. For a tabbed shell only the **default tab** counts — one loader stands in for many tabs and cannot be right about all of them, and the tab a person lands on unasked is the one worth being right about. If the `_surfaces/<defaultTab>-surface.tsx` convention ever breaks, the guard **fails and says teach me** rather than skipping the route.
2. **A new rule fails if any page renders masthead actions from somewhere the rule cannot follow** — so the blind spot cannot silently return in a third shape.
3. **The `actions` forwarding assertion that was missing.** The templates were asserted to forward `title` and **not** `actions`; a template that dropped it would read `undefined ?? 0` and stay green while all ten reserving loaders reserved nothing. Nothing else would catch it — `tsconfig` sets no `noUnusedLocals` and eslint has no unused-vars rule.
4. **`templateCall()` now reads every template call in a loader, not just the first** — a file with two returns was previously judged on whichever appeared first, which is a coin flip, not a rule.

🪤 **AND THE NEW RULE CRIED WOLF ON ITS FIRST RUN.** Following imports made `/admin/app-performance` demand a reservation for `actions={demoActive ? <span…/> : null}` — a badge shown only on demo data. **An action that may not be there is not an action to reserve.** Conditional bodies are now classed and exempted — and because an exemption that quietly grows swallows the rule it lives in, there is a **second floor on the unconditional count** (measured: 9 always · 1 responsive · 1 conditional; floor 8).

### Four published numbers were wrong

Corrected in the #4833 fragment (still uncollected), in the component's own docblock, and in the decision log. **144 → 142** composing loaders (a raw name-match counted two docblock mentions — `/explore`'s loader explains why it deliberately returns `null`); **43 → 41** title opt-ins; **"91 want none" → 101** (91 was the needed-no-edit figure borrowed for a different quantity); **"all 44 under `/admin` needed no edit"** was false, and that sentence is what a reader would have used to skip the very route that regressed.

🛡 **5 more mutations, each printed before → after, all RED, restored green:** strip `/admin/pricing`'s reservation again (3→2) · let guests reserve on a phone again (2→0) · make a template swallow `actions` (8→7) · make `actionsAt` decoration (1→0) · stop the guard following into the tab surface, i.e. recreate the original blind spot (1→0). **That last one is the proof the fix is the fix.**

SPEC IMPACT: None — loading-state shape only. No SKU, price, schema or copy change.
