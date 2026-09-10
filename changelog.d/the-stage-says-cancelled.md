## 2026-09-09 · feat(vendor-thread): the pipeline pill can say Completed and Cancelled

Phase 3 of the supplier inbox plan. The pill on a supplier's conversation had
four rungs — Inquiry · Quoted · Booked · Delivered — so a thread the couple had
**withdrawn**, or that had **expired**, or that the supplier had **declined**,
went on reading as a live `Inquiry` forever. The ladder is now Inquiry · Quoted ·
Booked · **Completed** · **Cancelled**, matching the approved prototype's own
vocabulary.

**⚠ The plan named `event_vendors.status = 'complete'` for the finished rung, and
that value is unreachable.** Measured against production before building it:
**no application writer exists anywhere** in `app/` or `lib/`, the only
migration mentions are read predicates plus one legacy backfill, and prod holds
`considering=33 · contracted=10 · deposit_paid=3` with **zero** rows at
`delivered` or `complete`. Built on it, the rung would have been the sixth
"gate with no handle". What is reachable, and what it now reads: the completion
handshake (`awaiting_vendor=45 · confirmed=1` in prod) **and** the couple-side
auto-flip 24h after the event, which writes `status` and touches no handshake
column. So this is a relabel plus a widening, not a fifth rung — said plainly,
because the plan argued the opposite from an enum that merely *has* the value.

The ordering now lives in one pure function (`resolveThreadStage`) and "is this
finished?" in one predicate (`rowReadsCompleted`), both shared by the thread pill
and the clients list — three mechanisms already track a thread's state and a
fourth private ranking is the failure this repo keeps producing. The clients
list gained the finished probe too, read with the service role scoped by the
shop's own id, because **`event_vendors` has no supplier read policy at all** —
a supplier's own session reads zero rows there, so the obvious query would have
reported every booking as unfinished forever.

Guard: `apps/web/lib/the-stage-says-what-happened.test.ts` — the ordering checked
over all 16 combinations, the finish line checked against every reachable and
unreachable writer, and every `chat_inquiry_status` value **derived from the
migrations** so a seventh one has to be classified rather than silently reading
as a live inquiry. 7 mutations, occurrence-counted, all red.

SPEC IMPACT: None — no schema, no pricing. One vendor-facing label changes
(Delivered → Completed) to match the approved prototype.
