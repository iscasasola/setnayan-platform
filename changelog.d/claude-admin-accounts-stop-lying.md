## 2026-08-17 · fix(admin): the five account surfaces stop printing "nothing here" over a refused read

S8 lane A. The five tabs of `/admin/accounts` — Users, Vendors, Demo vendors, Events,
Venues — render their lists through the shipped `<ConsoleTable>` archetype (PR #4506)
instead of six hand-rolled `<table>`s. **The archetype was not touched**: no new prop,
no actions API, no change to its 10 pinned assertions.

**What was actually wrong, and it was not looks.** Supabase RESOLVES with `{ error }`
rather than throwing, so a refused read — phantom column, stale enum value, unapplied
migration, missing grant — arrives as `data: null`. Every read on these five surfaces
coerced it with `?? []`, and **13 of 17 reads never bound their `error` at all**. The
page then printed a calm sentence saying there was nothing there. On an accounts screen
that reads as *"this platform has no users"*.

Measured per file, on `origin/main` = `f880f375f`:

| surface | reads | bound an error before | now |
|---|---|---|---|
| `users-surface.tsx` (TWO tables) | 4 | 1 | 4 |
| `vendors-surface.tsx` | 4 | 1 | 4 |
| `demo-vendors-surface.tsx` | 5 | 0 | 5 |
| `events-surface.tsx` | 4 | 1 | 4 |
| `venues-surface.tsx` | 2 | 0 | 2 |

- **A vanished section is worse than an empty one.** "New vendor requests" and "Pending
  claim" on the vendors tab are wrapped in `rows.length > 0 ? … : null`, so a refused
  read removed the whole section from the page — including the claim links couples are
  waiting on. Both now render on failure and hide only on a measured zero.
- **A destructive control no longer describes itself with a number nobody measured.**
  Demo vendors' cleanup panel took `totalCount` from `count ?? 0`, so a refused count
  produced *"Confirm: delete all 0 demo vendors"*. When the count is unknown the panel
  is replaced by a sentence and the bulk actions are not offered.
- **The most alarming figure on that page was produced by having no data.** "Empty
  categories" is derived by absence, so a refused scan made it equal the total number of
  categories — and it crossed the >50 threshold and painted itself amber, which reads as
  a finding. It is `null` → em-dash now.
- **Per-row rollups lied quietly.** Events showed guests / paid vendors / save-the-date
  views from three unbound reads via `?? 0`, so a refusal printed a confident **0
  guests** down the whole column. Each rollup carries whether it was measured; an
  unmeasured one renders an em-dash. The delete confirmation reads the same fact and
  warns when it could not check for paid vendors, instead of using the reassuring wording.
- **Two swallowed `catch { [] }` blocks** on the comp-grants panel: an account's existing
  grants and the SKU catalog. Both rendered as "none yet" to somebody deciding whether to
  gift a service.
- **Six silent caps disclosed**, each hoisted to one named const used at both the
  `.limit()` and the `cap` — 200 accounts (also the source of the header's hand-typed
  "Latest 200"), 200 blacklist, 200 claimed shops, 50 unclaimed, 50 requests, 500 venues.
  The 2000 demo-vendor cap is disclosed by `note`, not `cap`, on purpose: it limits the
  rows *scanned* and the table shows *aggregated batches*, so hitting it does not truncate
  the list — it makes the counts in it too small. A `cap` there could never fire.
- **3 gold-as-text AA failures fixed** (`text-terracotta` is the atelier gold #A9834B at
  3.37:1, not the CTA colour): two link hovers and the venues "Edit →" resting state, all
  → `text-link` (8.22:1). Numbered `text-terracotta-700` left alone. Assorted
  `text-ink/40` · `/45` · `/55` body text → `/70`.
- **1 PageMasthead** replaces five hand-rolled `<header>` blocks; the local `Stat`
  re-declaration is deleted in favour of `KpiStatCard`, which already renders the em-dash.
  Anything load-bearing that was in a header (the demo cleanup deadline, the venue total)
  moved OUT rather than into the desktop-only lede.

**One composition change, forced not chosen:** the comp-grants panel was an extra `<tr>`
with `colSpan={6}`. ConsoleTable renders exactly one row per row, so the panel is now a
sibling directly below the table. It keeps its `id`, so the row's `aria-controls` still
resolves; the `#u-<id>` anchor moved onto a span in the email cell so expanding a row
still scrolls somewhere. Nothing in the panel was redrawn.

Guard: `admin-console-is-one-table.test.ts` — five lines off `RAW_TABLE_BILL` (31 → 26),
five onto `CONVERTED`. The bill was re-derived by measuring the tree, not hand-edited.
Its rule 4 caught a real shape mid-build (three rollup loops still flattening `data ?? []`
beside a separate measured boolean — two halves that have to agree) and it was restructured
so the null check *is* the measured check. 10/10 assertions green, 8566 unit tests green,
typecheck clean, and `lint-port-no-lost-controls` reports no route lost a control
(402 routes / 1322 controls) **without regenerating the baseline**.

⚠ **Not observable from a session.** `/admin` sits behind a login, so this is test-proved
and measured — never seen. It is not verified live.

SPEC IMPACT: None. No schema, price, SKU, copy-of-record or owner-locked decision changes.
The judgement-queue rule (no buttons, a sentence instead) is untouched: nothing here is a
judgement queue, and no action was added or removed.
