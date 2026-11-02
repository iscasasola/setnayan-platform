## 2026-08-31 · fix(setnayan-ai): a lapsed discount stops discounting, not selling

Owner, 2026-08-31, on seeing the expired state: *"sai expired. should show a
cta button to purchase still."*

The comeback card removed itself from Home the instant the 24h window closed —
`resolveSetnayanAiComebackDisplayPhp` returned `null`, and the component
`return null`ed as well the moment its own countdown hit zero. So **the couple
who most needed a route to Setnayan AI, the one who did not buy in time, was
the only one left without one**: the sole remaining entrance was a Studio page
they would have to go looking for. The discount expiring is not the product
expiring.

**Now one card, two arms.** `decideSetnayanAiOffer` (pure, in
`lib/setnayan-ai-comeback-offer.ts` beside the window and price rules it
composes) returns a discriminated union:

- `comeback` — inside the host's one 24h window: discounted price, strike-through
  regular price, live countdown, "Unlock Setnayan AI · N% off".
- `full` — window never opened or has lapsed: same card, list price, **no**
  countdown and **no** strike-through (a struck price beside an identical live
  one reads as a fake markdown), "Unlock Setnayan AI".

`null` is now reserved for the two cases where there is genuinely nothing to
sell: the event **already owns** Setnayan AI, or its tier has no product (₱0 /
unusable list price). A lapsed window is no longer one of them.

🔒 **NO MONEY LOGIC CHANGED, AND NONE NEEDED TO.** The charge path's comeback
branch already falls through to the ordinary tier price the instant
`isComebackOfferEligible` goes false, so a card showing list price after the
lapse charges exactly that, re-derived server-side. A stale tab cannot buy at
yesterday's price and cannot be overcharged either.

⚖ **Fails closed on absence and on error.** An `eventId` missing from its own
scope resolves to `null` rather than being read as "unowned" — absent is
unknown, not safe to pitch. A refused scope read shows nothing rather than
defaulting to a full-price pitch, because that same read makes the charge path
REFUSE. An in-window row with no implied sign-up saving to halve (a NULL
onboarding price) falls through to the full arm instead of quoting a markdown
that does not exist.

🏗 **The decision moved to a testable module.** It was written first inside
`lib/setnayan-ai-server.ts`, which imports `server-only` — so nothing in it can
be unit-tested (`Cannot find module 'server-only'` under tsx, which is why that
file had no tests). The arms are a decision, not a read; the resolver now does
its three reads and delegates. `lint-server-only-boundary` passes: 673 client
files, 223 server-only modules, no value import crossing.

**Proved by mutation, not merely green** (24 tests in this suite, 53 across the
related ones): restoring the old `return null` on a lapsed window turns 3 tests
red; restoring the component's `if (remaining.isPast) return null` turns the
render guard red; dropping the ownership check turns the "owns it already" test
red. Each mutant was applied, measured, and reverted.

SPEC IMPACT: None. No pricing, catalog or schema change — the discount rate,
the 24h window and every price are untouched; only what Home shows once the
window has closed.
