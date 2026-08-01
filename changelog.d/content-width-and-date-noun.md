## 2026-08-01 · fix(checklist): cap the intro measure, and stop the `date` event type reading "your date date"

Two defects visible in one screenshot of `/dashboard/[eventId]/checklist` on a "Movie Night" event (`event_type = 'date'`).

### 1 · The intro paragraph had no measure

`ChecklistFull`'s intro was `<p className="text-sm text-ink/65">` — no `max-w-*`. Nothing upstream constrains it either: `SidebarShell` states outright that *"Main scroll area. Caller controls inner max-width / padding"* (`app/_components/nav/sidebar-shell.tsx`), and the caller — `app/dashboard/[eventId]/layout.tsx` — wraps children in `mx-auto w-full px-4 py-6 sm:px-6 lg:px-8`, i.e. **`mx-auto` with no `max-w-*`, so it centers nothing.**

**Measured, not eyeballed.** Sidebar is 16rem/256px expanded. On a 1440px desktop the text column is `1440 − 256 − 64 (lg:px-8)` ≈ **1120px**, and the intro's first line ran **~160 characters**. The comfortable measure is 45–75; `max-w-prose` is 65ch. That is ~2.2x over, and it degrades further on a wider monitor (1920px → ~1600px column).

Two changes, because the paragraph and the column are separate problems:

- the intro `<p>` gets `max-w-prose`, matching `budget/page.tsx` and `schedule/page.tsx` which already do this;
- the page **column** gets a new `.sn-col` primitive (64rem / 1024px, centred), because the rows were sparse at 1120px too.

### `.sn-col` — opt-in, not a layout cap

Defined once in `globals.css`'s Atelier-Glass Shell Kit. It is applied **per page**, not on `[eventId]/layout.tsx`, even though the dead `mx-auto` there is clearly where a cap was once intended. A blanket layout cap would have silently reflowed all **111** routes under `[eventId]` — including ones that want the width (`seating`, `studio/led`, `studio/live-studio-control`, the four `/print` routes) and three that already cap themselves *tighter* (`clearance` `max-w-2xl`, `access-requests` `max-w-3xl`, `manpower` `max-w-4xl`). Classifying 111 routes from their filenames would have been a guess; opting in per verified page is not.

**Applied to 13 routes** — checklist, budget, schedule, guests, details, documents, orders, activity, hosts, sponsors, disputes, contracts, paperwork (both render branches).

**Not applied, and why — no silent coverage claims:**

- `vendors` — its root is a tab shell; the first pass caught only `buildSlot`, one of four slots (`shortlistSlot` / `buildSlot` / `budgetSlot` / `compareSlot`). Capping one tab and not its siblings would look broken, so this was reverted. Needs the tab shell itself, which is a separate change.
- `suite` — deliberate `2xl:grid-cols-4` tile grid; 1024px would drop it to three columns on a wide monitor.
- `clearance`, `access-requests`, `manpower` — already capped tighter.
- The remaining ~93 routes are untouched and still inherit the full column.

### 2 · `date` events rendered the doubled noun

`checklistChrome()` built two strings from a `` `${noun} date` `` template. For `event_type = 'date'` the noun is literally `'date'` (`CHECKLIST_EVENT_LABELS`), so the live page read:

- intro — "Every due date is worked out from your **date date** — change the date and…"
- `dateHint` — "Add your **date date** to see a due date on every task"

Both are user-visible on every `date` event. Now routed through `eventDatePhrase(noun)`, which suppresses the suffix when the noun already ends in "date". **Derived from the noun rather than a hand-kept exception list**, so a future date-ish type (a "save the date" event) cannot silently reintroduce it.

Only `date` collided — `hangout`, `graduation`, `trip` etc. all read correctly and are untouched. Wedding chrome is byte-identical: it returns hardcoded strings from the early-return branch and never reaches the template.

### The guard

`checklist-event-labels.test.ts` gains a test that walks the **whole** `ANCHOR_BY_TYPE` roster (plus an unknown key and `null`) and asserts no string field of the resulting chrome repeats a word. Generation-based on purpose — a per-type `assert.equal` would only ever cover the types someone remembered to add.

**Verified it can fail:** reverting `eventDatePhrase` to the old template turns the suite red with `'date'.intro repeats "date"` quoting the exact live string; restoring it returns 6/6 green.

### Checks

88/88 pass across `lib/checklist*.test.ts`. `tsc --noEmit` clean (needs `--max-old-space-size=8192` locally or it OOMs — the 106-error run that preceded it was the OOM dump, not type errors). `lint:masthead`, `lint:radius`, `lint:legibility`, `lint:changelog-dir` all pass.

SPEC IMPACT: None — no SKU, price, schema, or flag change. Copy-and-CSS only, on an event type already live in `event_type_vocab`.
