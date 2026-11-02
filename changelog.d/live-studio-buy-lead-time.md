## 2026-07-27 · feat(live-studio): warn about the payment lead time BEFORE taking the money

The third of three safety rails a completeness audit named; the owner picked this one.

**The problem.** Setnayan is apply-then-pay with **manual** reconciliation on a 24-hour
SLA — a human checks the BDO/GCash inbox and approves the order. Every other SKU
absorbs that latency. A wedding cannot: an unlock bought the night before may still be
unapproved when the ceremony starts, and an unapproved order is an un-entitled event —
**one camera on the day they were promised several**, on a date that cannot move.
Nothing on the buy surface said so.

**New shared constant** `LEAD_TIME_NOTICE`, beside `ENCODER_NOTICE` in the Live Studio
copy module:

> Buy at least 2 days before your event. We check every payment by hand — usually
> within 24 hours — so an unlock bought the night before may not be approved in time.
> Buying earlier costs you nothing: your broadcast day starts when you first go live,
> not when you pay.

**Rendered prominently, not as fine print.** The existing `footnote` prop is 11px muted
text *below* the price — right for refund policy, wrong for a fact that decides whether
someone should pay today at all. `ChoosePlanSheet` gains an **additive optional
`notice`** prop that renders in a bordered block **above** the plan list. Optional with
no default, so every other SKU mounting that sheet renders byte-for-byte as before —
the same shape as `<Sheet wide>` and `<BroadcastWindowStrip compact>`.

**⭐ THE COPY AND THE ANCHOR GATE ARE ONE CHANGE IN TWO PARTS.** The last sentence is a
claim about `stampFirstLiveAt`, and it is true only because of **#3786** (2026-07-27),
which made the stamp refuse an un-entitled press. Before that gate, "buy earlier" would
have been advice to **burn their day sooner** — the opposite of help. So a test pins the
copy to the gate: it asserts the entitlement check still exists in `stampFirstLiveAt`
and fails if it is ever removed, because removing it turns this copy into a lie.

That test **did** fail on the first run — this branch was cut before #3786 landed — and
the branch was rebased onto it rather than the assertion loosened. The failure was the
test doing its job.

5 new tests in their own file (a new file cannot conflict with a concurrent PR).
4241/4241 unit green with the flag OFF and ON, typecheck + lint + production build
pass. No migration.

⚠ **Scoped to Live Studio deliberately.** The same manual-reconciliation latency
applies to every date-bound SKU (Papic on the day, 3D Plan, Live Wall), and the notice
is a shared exported constant so it can be reused — but sweeping it across the catalog
is a copy decision per SKU, not a mechanical edit, and was not taken here.

⚠ **Still unbuilt from the same audit finding** (owner's call): a go-live confirmation
before the day burns, and an admin "void this window" for an accidental press.

SPEC IMPACT: none — no behaviour changes, and the claim it makes is the behaviour
`Live_Studio_Unified_Spec_2026-07-25.md` § 4f ② already specifies.
