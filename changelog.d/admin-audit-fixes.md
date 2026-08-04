## 2026-07-16 · fix(admin): proto-vs-shipped audit fixes (work list, focal, sweeps, SLA copy)

Six verified findings from the admin proto-vs-shipped discrepancy audit (proto:
corpus `prototypes/admin_hq_v2_2026-07-15.html`), on top of #3268:

- **HIGH — `/admin/work` dropped `integrity-watch`.** `BASE_ROWS` listed 15 of the
  16 `ADMIN_QUEUE_META` queues, so the command center's ranked worklist and its
  `totalOpen` undercounted (an open integrity flag was invisible on the work list).
  Added the missing row. Extracted `BASE_ROWS` to `lib/admin/work-rows.ts` (with an
  explicit `WORKLIST_EXCLUDED_KEYS` list) and added `lib/admin/work-rows.test.ts`
  asserting `BASE_ROWS` keys ⊇ `ADMIN_QUEUE_META` keys minus the explicit
  exclusions — so the next new queue can't silently vanish from the worklist.
- **MED — work feed rode retired tokens.** `queues-triage-feed.tsx` still used the
  retired Saira/`--m-*` idioms (`m-card`/`m-label-mono`/`m-display-tight`/
  `var(--m-*)`); converted to the sn-* kit (`sn-row`/`sn-tile`/`sn-eye`/`sn-h1` +
  `font-mono`) per the shipped admin idioms (#3267/#3268). Value-faithful token
  swap; rows stay opaque (`sn-row`, blur budget § 1.6). Urgency accent hexes are
  literals (not `--m-*` tokens) and were preserved.
- **MED — app-performance surfaces half-swept.** Finished the mechanical
  `var(--m-*)`→`var(--sn-*)` conversion in `app-performance/_surfaces/{growth,
  overview,intelligence}-surface.tsx` (116 refs). No `m-display-tight`/class tokens
  were present in `_surfaces` (only inline vars). Chart-series and status colors
  mapped by warm semantics (blush-deep→danger, sage-deep→success, orange→gold).
- **MED — Exception Desk focal showed coarse lanes.** The `/admin` obsidian focal's
  top-3 preview ranked the 4 overview category lanes; the proto ranks the busiest
  INDIVIDUAL queues. Evolved it to the top-3 queues by open count, each linking
  into its queue with its `ageShort` oldest-open age. Derived from the
  already-fetched digest-backed tile values — no new query.
- **LOW — verify SLA copy.** Customer-facing header promised "3–5 business days";
  aligned to "within 72 hours" (proto's owner-approved copy; the internal 48h
  `ADMIN_QUEUE_META.verify.slaHours` target and the admin-only SlaBadge business-day
  tooltip are unchanged). Removed the stale comment claiming the heading still uses
  `.m-eyebrow`/`.m-display-tight` (Saira) — it's been `.sn-eye`/`.sn-h1` since #3268.
- **LOW — pending-₱ money lens: DEFERRED.** The proto's money tile (pending peso
  value + largest reference) needs a NEW aggregate: the overview only fetches
  head-counts and the shared digest (count + oldest-timestamp, no amounts), and
  PostgREST can't `SUM` without a new RPC/migration or an unbounded pending-rows
  fetch. Per the audit's "skip if it needs a new heavy query — never fabricate",
  deferred rather than added.

SPEC IMPACT: None — bug fix + visual token sweep + copy alignment; no schema,
route, pricing, or locked-decision change.
