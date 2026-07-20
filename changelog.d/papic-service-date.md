## 2026-07-21 · feat(papic): the couple picks the service date — and the pass stops being permanent

**The hole this closes.** `eventPapicGuestActive()` was a pure ownership check —
`eventSkuActive(event, 'PAPIC_GUEST')`. **No date dimension existed anywhere**, so one purchase left
every guest's camera live from admin approval onward, *forever*. Nobody chose that; it fell out of
the pass never having had a window, and it is a storage and consent exposure.

**🔴 It also fixes a bug introduced two PRs ago.** Migration `20270828140000` split the flat pass
into three purchased buckets plus a top-up, but the gate still checked only `PAPIC_GUEST` — so a
couple buying the **6,000- or 10,000-shot rung would have been granted points and gotten no
cameras**. `PAPIC_PASS_SERVICE_KEYS` now covers all four.

**The model** (owner 2026-07-21): the couple picks the **service date** at purchase; buying several
passes covers several dates — pre-nup, ceremony, after-party. Every capture from every date lands in
**one album**, which needed no work: photos key to `event_id`, never to a purchase.

**Points stay pooled** — one wedding purse across all dates. The date controls *when cameras work*,
not how points are partitioned. That leaves the fail-closed reserve RPC untouched (money code),
matches the one-album model, and lets a quiet pre-nup leave more for the reception. Accepted trade: a
busy day can eat a later date's budget; the top-up is uncapped but pre-event, so the checkout
arithmetic carries the warning.

**NULL = unscoped = always on.** Both columns are nullable and **nothing is backfilled** — the
migration *asserts* no pre-existing grant got a date, since that would strip cameras from a live
event. So this can only ever add cameras relative to the old behaviour, never silently remove them.
No grandfathering clause needed; don't write one.

**⏰ The timezone trap.** `manilaToday()` resolves the date in **Asia/Manila**, not UTC and not
`CURRENT_DATE`. PH is UTC+8, so a wedding morning maps to the *previous* UTC date — 7am Manila on the
21st is 11pm UTC on the 20th. Gating on UTC would have shut the cameras for **the first eight hours
of the day the couple paid for**. Verified across four boundary cases including both midnights.

**Fail-open, deliberately.** `isPapicPassOpenOn` returns true on a read error — unlike the capture
gate. It runs *after* ownership is confirmed and the authoritative spend guard is the fail-CLOSED
points RPC, so a transient DB hiccup must not black out a paid couple mid-reception. Worst case it
lets someone reach a surface where the real meter still refuses.

- `orders.service_date` (nullable, generic — any dated service may adopt it)
- `papic_event_point_grants.service_date`, copied at activation. Denormalised so the hot-path date
  check is a single-table read, and so a refund reversal (DELETE by `order_id`) removes the window
  with the points.

⏳ Still needs `supabase db push`. A date picker at checkout is the remaining UI half.

SPEC IMPACT: `0012_papic/Papic_Pricing_Lock_2026-07-20.md` § 2.3 — service-date model recorded.
