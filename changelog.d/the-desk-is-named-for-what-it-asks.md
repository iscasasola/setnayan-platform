## 2026-09-22 · fix(vendor-today): the answer list is named for what it asks, and holds only cards that ask

The Today page's centrepiece was headed **"What's new"** — a news name on a to-do
list. The owner said so on the 2026-08-26 drawing he approved ("yes i agree",
`prototypes/vendor_dashboard_rearranged_2026-08-26.html`): it *"mixes five things
waiting on you with a 5-star review that needs nothing."* The label rename, the
Customers/Shop reorder, the contracts move and the three tool shelves all shipped
from that drawing. This part did not.

**What changed**

- The heading is now **"Needs your answer"**, with one status line beside it —
  `3 waiting · oldest 4 days`.
- Three card kinds render no control at all and now sit under their own heading,
  **"Nothing to answer"**, below the asks: a booking window that shut
  (`lock_request_lapsed`), a proposed meeting whose time has passed, and an open
  dispute. Nothing is removed from the page; one list became two.
- New pure module `apps/web/lib/vendor-desk-disposition.ts` holds the rule,
  because `vendor-overview.ts` is `server-only` and a guard cannot call into it.
- `cardTimestamp` is now exported from `vendor-overview.ts` — **and stays in that
  file under that name**, because `answers-desk.test.ts` locates it with
  `indexOf('function cardTimestamp')`. The page reads the oldest wait through it
  rather than owning a second copy of "when did this start waiting".

**What deliberately did not change**

- The `whats-new` anchor id. Two shipped doors point at that fragment — the focal
  tile's "Answer them" and every Ongoing row's `/vendor-dashboard#whats-new` — and
  a fragment link to a missing id scrolls nowhere and throws nothing.
- The feed's order. `fetchVendorOverviewData` already sorts oldest-waiting-first;
  `splitDesk` preserves that order and does not re-sort.
- **A five-star review is still an ask.** The drawing files it under "Good news",
  but the shipped card carries a reply box at every rating, so moving it would
  take the reply box away. Splitting reviews by rating or by whether they carry
  text is a product rule nobody has written down — flagged for the owner, not
  invented here.

**The guard** — `apps/web/lib/the-desk-answers-and-the-news-does-not.test.ts`
EXECUTES the rule rather than grepping for it. Its fixture is a
`Record<WhatsNewCard['kind'], WhatsNewCard>`, so a twelfth card kind fails to
compile in two places at once until somebody decides which side it belongs on —
measured, not asserted: adding a `sabotage_kind` to the union produced TS2741 on
the fixture and TS2366 on the switch. Three sabotages of the rule itself
(dispute→answer, empty desk→0 days, split re-sorts) each turned it red.

SPEC IMPACT: None. This builds the 2026-08-26 `DECISION_LOG.md` entry that is
already recorded; it adds no new decision. The open owner question about
five-star reviews is raised in the PR body, not settled here.
