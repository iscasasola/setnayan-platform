## 2026-09-09 · feat(bench): the bench says where each supplier stands

A shortlist card offered **Add to build · Check inquiry · Lock this** and said
nothing about WHERE THINGS STAND. "Check inquiry" looked identical whether the
supplier replied an hour ago, sent a quote waiting on the couple, or went quiet
for three weeks — so three caterers side by side in a category row was a
comparison the couple could not actually make without opening all three.

Three things ship together, and the order matters: the sentence is the feature,
the relabel is only the button agreeing with it.

1. **A standing sentence on every contacted supplier's card**, under the
   free-days line:

       Garden Buffet   — Quoted ₱187,500 · waiting on you
       Lumen Kitchen   — Replied yesterday
       Verde Catering  — No reply · 12 days

2. **The roll-up** — "2 suppliers replied — …" — one line at the top of the
   bench, above the coverage strip and every folder.

3. **"Check inquiry" → "Open conversation"**, matching the aria-label that
   already said exactly that (`cardCheckInquiryLabel`).

**ONE DERIVATION.** The owner allowed the sentence to appear in more than one
place (*"yes, it is fine to show it twice"*); what makes that safe is that it is
computed once. `lib/supplier-standing.ts` is pure — no React, no I/O, no clock —
and takes facts, returns segments. `lib/conversation-list.ts` is the only caller,
and a guard fails if a second one appears. The Picks column and the
conversation's Decisions view render this same answer when they land.

**THE STAGE IS NOT DERIVED AGAIN.** `resolveThreadStage` + `rowReadsCompleted`
stay the one ladder; the rung arrives already decided and its word always comes
from `THREAD_STAGE_LABEL`, so only those five words can wear a stage word.

**One probe set, two consumers.** The three batched couple-side stage probes
moved out of `buildCoupleConversationRows` into `readCoupleStageFacts`, which the
bench now shares — a bench card and the conversation it opens cannot disagree
about the same supplier. `buildBenchStandings` adds ONE last-message read for the
whole bench: two queries for the page, never one per card.

Guards: new `lib/the-bench-says-where-you-stand.test.ts` (18 tests), **eight
mutations tried and all eight caught** — including the count-guard walk-past
(`completed.has(id) ? 'completed' : resolveThreadStage(…)`), a second derivation
in the component, a hand-typed ladder word, and a sixth invented one.
`the-bench-card-keeps-everything` pins the new line as element 15;
`the-bench-is-legible` gains five measured pairings (9 total), all clearing AA in
both themes; `lint-port-no-lost-controls` green with its baseline untouched.

Not on the row-2 "More in {category}" marketplace cards — those are strangers the
couple has never spoken to, and a "Where you stand" label over nothing reads as a
sentence that failed to load.

Behind `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED`, confirmed by the owner as **true in
production** on 2026-09-09, so this is visible on merge.

SPEC IMPACT: `DECISION_LOG.md` — the standing sentence is derived once and may be
rendered on several surfaces; the bench card carries the per-supplier detail and
the Picks column at most the roll-up.
