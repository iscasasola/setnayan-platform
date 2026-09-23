## 2026-09-22 · feat(quote): the quote records which service cards it was built from

Commit two of slice E. The reader, the column and the thread wiring landed in commit one; this is the
writer that fills it.

**The builder already knew.** It loads one or several service cards and holds exactly which ones. That
was discarded at send, so the thread had to guess with a timestamp — and a quote built from one card
retired every other offer in the conversation.

**The chain, mirroring the gift switch's exactly:** composer sends the picked ids → the action parses
an array and forwards → `sendCustomProposalCore` accepts → the insert stores it.

⚠ **`?? null`, never `?? []`.** An empty array asserts "this quote covers no card". A quote from an
older client never made that decision, and storing `[]` for it would retire nothing while *looking*
like an answer. Three states stay distinct all the way down: absent is silence, `[]` is a statement,
a list is a list.

⚠ **THE TEMPLATE PATH IS DELIBERATELY NOT WIRED, AND THAT IS PINNED BY A TEST.** `proposal-send.ts` has
**two** doors into `vendor_proposals` — `sendProposalCore` (a saved template or package) and
`sendCustomProposalCore` (the builder). Only the second has a card picker; the first genuinely cannot
say which cards a quote covers, so NULL is the honest value and the reader's fallback handles it.
Guard 4 asserts the template half writes nothing, so nobody later wires it with a guess.

🔑 **BOTH DOORS WERE ALWAYS THERE — the rebase did not add one, and an earlier draft of this note
said it did.** Measured across the refs:

| ref | send paths | `includesSetnayanGift` | my type-anchor matched |
|---|---|---|---|
| base slice E was cut from | 2 | 2 | **1** |
| main after wave 3 | 2 | 4 | **2** |

`sendProposalCore` and `sendCustomProposalCore` both existed at the base. What changed is that **wave 3
gave the pre-existing template path the same gift field**, so an anchor that was genuinely unique when
written became ambiguous. **An anchor is a proxy for a location, and a merge can make a unique proxy
ambiguous without adding anything you would call a new door.**

The edit asserted `count == 1` and was refused. Without that assertion a blind replace would have
patched the **template** path, left the builder untouched, and every test would have stayed green with
the column permanently NULL — indistinguishable from "nobody has quoted yet".

**Why a chain guard rather than a rule test:** every link is individually unremarkable, and the value
is silently lost if any one drops it. Each break leaves every other test green and the column
permanently NULL — which reads exactly like "no quote has said yet".

**Three sabotages watched red:** composer stops sending · action forwards without parsing · insert
stores `?? []`.

SPEC IMPACT: None — persists what the builder already computes. No new price, no new copy.
