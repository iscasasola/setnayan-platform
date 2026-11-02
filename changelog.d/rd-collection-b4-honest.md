## 2026-09-24 · fix(home): a card whose reads failed says "couldn't load", never "nothing needs you"

Step B4 of the owner-approved collection template (DECISION_LOG 2026-09-24: "unknown ≠ zero").

The home board turned a refused read into zeros in two layers, so a card could say nothing needed
you off a read that never completed:

- **The helpers.** Honest siblings, each returning `null` for "could not read":
  `readChecklistItems` (`lib/checklist.ts`), `readEventDecisionCounts` and `readEventUnreadCounts`
  (`lib/event-decisions.ts`). The decision read now checks each query's `error` — a supabase builder
  RESOLVES with `{ error }`, so the old `try/catch` never saw a refusal. The existing `fetch*`
  functions are thin wrappers over them and keep their graceful behaviour for their other caller
  (`event-dashboard.tsx`), byte-for-byte in what they return.
- **The launcher.** It reads the honest ones and no longer `.catch(() => new Map())`s. A failed
  decision/unread read, or a failed checklist read on a live event, makes that card's summary `null`
  → the strip's **"Couldn't load what needs you"**; a failed checklist read makes the ring **"–"**
  ("progress couldn't load" in the accessible name) instead of vanishing as though there were no
  checklist. Never on an invited card. Applies on every shelf (the glass card already rendered
  `count: null` / `pct: null` honestly — nothing fed it one).

`Readout` (`rd/design-foundation-parts`) was NOT brought: its `.sn-num` figure is 28–36px over an
`.sn-eye` label in a column, and the strip is a 54px row with an 18px figure beside a ring — it does not
fit, and forcing it would re-draw the strip. It still waits for its first real adopter.

Tests: `lib/the-board-card-reads-are-honest.test.ts` — executed against a fake client whose queries
resolve with `{ error }` (either decision query refused ⇒ null; the wrappers unchanged), plus the
launcher's wiring (honest reads, `summary === null` → `{ count: null }`, all five shelves pass the
failed-progress flag). Sabotage (`readEventDecisionCounts` ignoring `failed`) went red.

SPEC IMPACT: None.
