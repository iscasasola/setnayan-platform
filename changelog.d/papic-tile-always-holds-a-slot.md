## 2026-07-30 · fix(papic): the Papic tile always holds a bento slot — it is the foundation of the app

Owner, on reading PR-G's shipped behaviour: **"always hold a slot. since that is the foundation of the app."** This is that reversal.

### What was wrong with the first cut

[#3895](https://github.com/iscasasola/setnayan-platform/pull/3895) let Papic take a bento slot only when one was **free**, to protect the block's documented blur budget (*"focal(1) + digest(1) + ≤4 minis + chrome(2) ≤ 8 above fold"*). The consequence, which I flagged when reporting it: on a **mature** event — guests invited, budget committed, schedule filled, unread threads — all four slots were taken, so a couple who had not shot anything yet saw the nudge and, **once they dismissed it, no Papic on their home at all.** For the product's foundational feature that is the wrong default.

### The fix — ranked, not appended

`if (papicMini) miniTiles.push(papicMini);` — unconditional, and pushed **before** the Messages block so the priority is **structural** rather than index arithmetic:

> Guests → Budget → Schedule → **Papic** → Messages

The cap then makes the order bite. Papic is never dropped; Guests, Budget and Schedule are never displaced.

**The budget stays at 4 rather than growing to 5, deliberately.** "Always hold a slot" is a statement about Papic's *priority*, not a licence to put a ninth `backdrop-filter` layer on the couple's first screen. So on a fully-populated dashboard it is **Messages** that yields its tile — the least structural of the five: unread vendor threads are transient, they carry their own nav badge, and the open count also renders in the decisions digest directly above this grid. If the owner would rather keep Messages and accept the fifth blur layer, raising `MAX_MINIS` is a one-line, deliberate change with the trade-off written next to it.

An earlier attempt at this used `miniTiles.splice(3, 0, papicMini)`, which was fragile in a way worth recording: it assumed Messages sits at index 3, so whenever **Schedule** had nothing to show it silently placed Papic *after* Messages. Push order has no such failure mode.

### Three guards, and I checked that they bite

Added to `lib/papic-home-tile.test.ts` in the repo's source-scan idiom (cf. `papic-copy-guardrails`, `panood-retirement`), because the rule lives in a 400-line server component a unit test cannot render — and the failure mode is **silent**: the tile just stops appearing.

1. The push is **unconditional** (and no `splice(` remains).
2. Papic is pushed **after** Guests/Budget and **before** Messages.
3. `MAX_MINIS = 4` still exists and still trims.

**Mutation-tested rather than assumed** — a guard that passes on correct code but wouldn't catch the regression is worthless:

| mutation | result |
|---|---|
| reintroduce `&& miniTiles.length < 4` (the exact bug reversed here) | **2 tests fail** |
| move the push below the Messages block | **the ordering test fails by name** |
| restore | 12 / 12 pass |

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,446/5,446 pass**. No local `npm run build` (7 GB heap → SIGTERM 143).

**Unchanged:** the nudge. It still introduces Papic once and retires on dismiss / first capture — but the gap it was partly covering (a full dashboard with no Papic presence) is now closed by the tile itself, so its job is purely the introduction.

SPEC IMPACT: `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` §2-G amended (the slot is guaranteed; the mini-cap rationale updated) + `DECISION_LOG.md`. No price, SKU, schema or flag change.
