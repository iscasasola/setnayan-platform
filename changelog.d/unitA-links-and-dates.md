## 2026-08-08 · design(#4): event Overview — link colour + day-first dates

Unit A slice 2 of the Warm Editorial Archive port. Style-only, zero behaviour change.

**Text links → the link colour.** Four sites moved from gold-700 to
`rgb(var(--color-link))` `#3B4E67` — the mini-tile feet, the "see the decisions
board" anchor, the checklist doorway, and the recent-activity link. These are exactly
the three the spec names ("mini-tile feet, checklist doorway, activity link") plus the
decisions anchor.

**Dates are day-first.** `shortDate` produced **"Dec 12"**; the handoff specifies
**"12 Dec 2026"** (short form "12 Dec" in chips and rails). `en-PH` orders
month-first, so the formatter's locale is pinned to `en-GB` purely for ORDER — the
month abbreviation is identical in both, so nothing else moves.

**Gold deliberately kept** on everything that is not a link — verified one by one
rather than by pattern:
- the chip tone map and all four `gold-100` background chips (gold IS the "waiting"
  chip tint in the spec)
- the schedule item's **date eyebrow** (`font-mono uppercase`) — an eyebrow, not a
  link, and the spec keeps eyebrows gold

Nine gold-700 text sites remain, all of them chips or eyebrows.

**Integration checks** (`INTEGRATION_RULES.md`): 9 insertions / 6 deletions — the +3
is the explanatory comment · zero components removed · zero conditionals removed ·
only colour and date-order lines changed.

Typecheck clean · all 12 `lint-*.mjs` clean · **7085/7085** unit tests green under
**Asia/Manila, UTC and America/New_York** (the house timezone rule — this touches a
date formatter, so all three matter).

SPEC IMPACT: None.
