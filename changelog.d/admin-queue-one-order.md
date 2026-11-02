## 2026-08-09 · fix(admin): one shared order for the job queues on both admin screens

Two admin screens ranked the same job queues in opposite orders, so the same person
reading both was told two different things were the most urgent thing to do.

- The command center (`/admin/work`) ranked **overdue first**, then due-soon, then
  busiest — using a private `DUE_RANK` table declared in the route file.
- The Overview's "busiest queues" preview (`/admin`) sorted on **open count alone**
  (`(b.value ?? 0) - (a.value ?? 0)`), so a big pile that was comfortably inside its
  promise outranked a small queue that had already blown past it.

`/admin/work`'s own docblock claimed the two surfaces "agree by construction". They did
not — the counts agreed, the ORDER never has.

**What changed**

- `lib/admin/queue-counts.ts` now exports `QUEUE_DUE_RANK` + `compareQueuePriority()`
  — urgency band first (overdue → due-soon → ok → unknown → clear), busiest inside the
  band, `0` on a full tie so each caller's own declaration order breaks it.
- `app/admin/work/page.tsx` deletes its private `DUE_RANK` and calls the shared
  comparator (visible order unchanged — this surface's rule is the one that won).
- `app/admin/page.tsx` ranks its top-3 preview with the same comparator instead of raw
  volume. Its "Taxonomy requests" tile — the only tile with no digest row and no SLA
  clock — now carries a state from the existing no-clock rule (`computeDueState(...,
  null, ...)`), so it isn't read as `unknown` and sunk below every queue that merely has
  work. Render-neutral: the tile paints identically for `ok` and for no state at all.

**Guard** — `lib/admin/queue-priority.test.ts` (7 tests). Asserts the shared order exists,
is non-empty and has distinct bands; that BOTH surface files call the shared comparator;
that neither declares a private due-state rank table; and that neither sorts on volume
alone. All source assertions strip comments first, so the guard cannot pass on the prose
explaining the bug — that stripping is itself asserted.

Mutation-tested (baseline 7/7 green):

| sabotage | result |
|---|---|
| Overview re-hardcoded to `(b.value ?? 0) - (a.value ?? 0)` | RED — "ranks queues on volume alone" |
| …and the import removed too | RED — 2 tests (also "sorts by the shared comparator") |
| Work list's private `DUE_RANK` table restored | RED — "keeps a private urgency-rank table" |
| `compareQueuePriority` left only inside a comment | RED — stripper removes it, presence check fires |

SPEC IMPACT: None — no product, pricing or scope change. The ranking RULE is unchanged;
only the Overview's preview was brought onto it.
