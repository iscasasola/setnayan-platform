## 2026-09-22 · feat(quote): the builder walks five steps on one spine

Owner, 2026-09-22: *"create evident separation for different brain processes. how can they see
the information, then what next, and so on. build a clean continuity."*

- NEW pure `lib/quote-stages.ts`: the five steps (Know the event · Choose what to offer · Set
  the price · Terms · Review & send), `openingStage` (a fresh quote opens at 1, "Update this
  quote" at Set the price), `stageStates`, `nextStage`, and `stageSummaries` — one true line per
  folded step, written from the live draft through the shared money formatter; a missing fact
  prints nothing, never a dash. Executed by `quote-stages.test.ts`; three sabotages watched red.
- `ProposalMaker`: the existing blocks are WRAPPED, not redrawn, into five `<QuoteStage>`
  sections in that order (header → cards + package picker → lines, crew & travel, total, fee,
  Papic → schedule, rails, title/valid/note → the sending sentence + Send). The current step is
  open; done steps fold to their line (✓) and reopen on tap; later steps fold as "Up next";
  every step but the last ends in a dark Next band naming the next step; a step strip sits at
  the top. A folded body is HIDDEN, never unmounted, so every input keeps its state and every
  existing mount guard keeps its count (all 37 affected unit tests unchanged and green).
- Guard `app/_components/the-quote-walks-five-steps.test.ts`: exactly five steps, the rule's
  order, each block in its step, Send on the last step only, hide-not-unmount; three sabotages
  watched red.

SPEC IMPACT: None beyond the 2026-09-22 DECISION_LOG row.
