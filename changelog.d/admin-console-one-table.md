## 2026-08-17 · feat(admin): one console table — and a failed read can no longer print "nothing here"

The Setnayan team works in ninety-odd hand-built tables. Measured on `origin/main` this evening: **108 admin routes · 34 files under `app/admin` hand-rolling a raw `<table>` · `app/admin/_components` holding 13 files, none of them a table.**

**RULE 0 first, and it paid: three of the four pieces already existed.** The archetype is `PageMasthead` (the council-locked shared page header, "for every dashboard, vendor-dashboard and admin surface" — **1** admin consumer against 96 hand-rolled `<header>`s) + `KpiStatCard` (the admin KPI tile whose own docblock says it is "the ONE admin-local source" — 3 consumers against **22** local `Stat`/`StatTile`/`Metric` re-declarations) + the six-state primitives in `app/_components/states/` (`resolveSurfaceState`, `EmptyState`, `ErrorState` — shipped with **zero** consumers). Only the table itself was missing. That is the whole new file.

**And the markup was already a convention nobody could import.** 13 of the 34 tables open with `w-full text-left text-sm`; 12 carry the identical `bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em]` header recipe. So the debt was never that they look different. It is that each one re-decides the three things that are easy to get wrong.

### 1 · A failed read renders as an empty list — 16 of the 34, measured

Supabase **resolves with `{ error }`** instead of throwing, so a rejected query (phantom column, stale enum value, unapplied migration, missing grant) arrives as `data: null`. `(data ?? [])` turns that into an empty array and the page prints a calm sentence. Live in production code right now:

| surface | what a broken read says |
|---|---|
| `/admin/approvals` | *"No approvals pending. Set na 'yan."* — on the four-eyes queue whose only job is that a second admin looks |
| `/admin/fraud` | *"No open fraud signals."* |
| `/admin/pax-changes` | *"No pax-driven cost changes yet."* — to a mediator asking why a vendor's cost jumped, mid-dispute |

Its docblock called that *"graceful-degrades to an empty state if the migration isn't applied"* — **a defect described as a feature.** That line is now a correction naming what it actually did.

**ONE surface already got it right** — `browser-blocks-surface.tsx`, whose own comment reads *"A FAILED READ IS NOT AN EMPTY LIST"*. `ConsoleTable` makes that the default instead of a thing each author remembers, by making the wrong thing **unwriteable**: `rows` accepts `null | undefined` and treats it as NOT MEASURED so it can never fall through to Empty; `readPermitted` is typed as the literal `true`, exactly as in `EmptyState`, so a caller cannot claim Empty without proof; and precedence belongs to the one tested resolver, not to a local `if (rows.length === 0)`.

🔑 **`count === null` MEANS "NOT MEASURED", NOT "ZERO".** Filing an unmeasured queue under "N queues are clear" puts it in the one place a reader has been told they need not look — and it looks completely fine. On `/admin/receipts` the money tiles now pass `null` on a refused read, so they show an em-dash rather than a confident **₱0** that reads as *"no money came in"*.

Why `readPermitted: true` is honest here **and where it stops being**: these pages read through the service-role client, which RLS cannot silently filter, behind `requireAdmin()`, which proved the role by reading it back. **Both halves are required.** A surface reading through the RLS client has not proven anything — an RLS denial and an empty read are the same `count: 0` — and must pass the value it actually holds.

### 2 · Silent truncation — 15 of 21 capped reads never said so

21 of the 34 tables `.limit(...)` and only 6 disclose it. `/admin/approvals` caps recently-decided at **10** with no note; a demo-vendor surface at **2000**. Silent truncation reads as *"this is all of it"*, which is the wrong answer for anyone reconciling money. `cap` takes the **same constant** the query used — two hand-typed copies of a number is not a guard — and a full page says so.

### 3 · The header label fails AA, and had to be corrected rather than copied

Measured in both themes: the shipped `text-ink/55` on its own `bg-ink/[0.03]` fill is **3.24:1 light** / 5.50:1 dark — under the 4.5:1 floor, at 11px, where no large-text exception applies. It is on ~12 admin tables today. The archetype keeps the structure and moves to `text-ink/70`: **5.02:1 light / 8.32:1 dark**. Do not "restore" ink/55 for consistency with the unconverted tables; consistency with a measured failure is not a reason.

Two more, in the primitives this became the **first consumer of** — so they are now this change's problem, and a light-only check waves both through:

- `EmptyState`'s audit line at `text-ink/45` → **2.62:1** on cream. Now ink/70 (5.29 / 8.93).
- `ErrorState`'s three beat labels at `text-ink/45` → **2.44:1** on its own mulberry/5 panel. Now ink/70 (4.94 / 8.40).

Nothing was live: both shipped unmounted.

🎨 **TWO GOLDS, TWO RULES, third time it has bitten.** The Tailwind slot named `terracotta` holds the atelier **gold** `#A9834B` (3.37:1 — non-text only); the CTA terracotta `#C24E25` lives in the slot named `mulberry` (4.61:1). Backwards and inherited, so `text-terracotta` *looks* safe and is the unsafe one. `/admin/receipts`' "View" link was painted in it and is now `text-link` (8.22:1).

### Converted — the first tranche, and it is a tranche

`/admin/pax-changes` · `/admin/receipts` · the price-bands surface. Deliberately the pure records lists, where the whole page **is** the table, so the archetype is proved on real data without re-deciding any page's composition. **31 files remain and every one is named in the guard.**

🔒 **JUDGEMENT QUEUES GET NO BUTTON, and the archetype cannot give them one** — it has no actions API at all. Disputes, fraud, user reports, erasure requests, integrity watch, concierge abuse, force majeure: a fast button invites a wrong call at speed on exactly the queues where being wrong costs most. Silence alone would read as an unfinished screen, so `note` puts a **sentence** where the controls would be. The action shape is decided by what the server action refuses to run without — reviews throw without an override reason, payouts need a method and a reference — never by a table prop that makes every queue look one-click.

### The guard — `admin-console-is-one-table.test.ts`

**A BASELINE IS A BILL, NOT A DECISION.** The 31 remaining files are pinned **exactly**: a 32nd adopting a raw table fails, and converting one also fails, telling you to delete its line. Never add a line to go green.

It strips comments before matching, and that is not cosmetic — every converted surface carries a note naming the string it removed (`data ?? []`, `text-terracotta`, `text-ink/55`), so a raw-source guard reports the defect it just fixed. **Raw source: 6 offences. Stripped: 0. And 0 is the true number.**

🛡 **All 10 assertions mutation-checked, occurrence count printed before → after, every one RED:** resolver call deleted (1→0) · the `!measured` half dropped (1→0) · `rows` made non-nullable (1→0) · a caller back to `?? []` (0→1) · a caller dropping `readError` (1→0) · the header alpha "restored" to ink/55 (3→1) · the cap sentence deleted (1→0) · the AA fix reverted in both primitives (0→1 and 0→3) · an actions API added (0→1) · a 32nd raw table introduced. Baseline restored to 10/10 and the tree verified identical to the pre-mutation commit — **committed before mutating, and restored from an explicit backup, never from the index**, because a `git checkout --` after a sabotage silently reverted six uncommitted files in this repo on 2026-08-17 while the guard still passed.

🪤 **The guard's own first run cried wolf** and that is why the icon exemption exists: it failed on the gold `Gauge` glyph beside the price-bands heading. **Gold on an icon is correct** — 3.37 clears the 3:1 non-text bar. A guard that cries wolf teaches you to skim past the one time it is right, so the exemption is narrow: the class must be last in the string with `strokeWidth` immediately after, which only a lucide icon produces.

### Two findings recorded, not fixed

- `offline/_components/offline-diagnostic.tsx` renders `className="m-table"`, and **there is no `.m-table` anywhere in the repo.** `.m-card` exists, so the name reads plausible and styles nothing — the same silent-absence failure as a phantom column. Noted on its line in the bill; fixing it means converting that file.
- **`text-terracotta` appears 236 times across 89 files under `app/admin`.** Sweeping it is a separate, bounded job, not a side effect of this one. The guard covers the archetype and everything converted, so the count can only fall from here.

`ugat/_components/ugat-console.tsx` is on the bill but **is not owed** — it ships its own stylesheet (`ugat-console.css`, where `.ug-etable` is genuinely defined) and is a purpose-built graph console, not a records list.

`scripts/port-control-baseline.json` regenerated in the same PR for the one deliberate removal (`/admin/receipts`' local `<Stat>` → `KpiStatCard`).

⚠ **Regenerated only AFTER rebasing onto the current `origin/main`, and that mattered.** Generated first from my own branch tip it recorded **401 routes**; regenerated on the merged tree it records **402** — the extra one is `/dashboard/[eventId]/website/stories`, a route another session merged (#4503) while this was in flight. Landing the first version would have silently deleted a brand-new route from the baseline, leaving it unguarded exactly the way ~20 public pages went unguarded when they moved into the `(shell)` group. **A baseline generated from a stale tree clobbers whatever landed in between.**

**Verified per route, not by totals:** comparing `origin/main`'s baseline against the regenerated one gives **0 destinations lost · 0 actions lost · 0 routes gone**, and exactly one block removal — `/admin/receipts` losing `Stat`. That single readable line is what the lint exists to produce.

SPEC IMPACT: None — no SKU, price, schema or migration. Internal admin surfaces only; no customer-facing screen changes.
