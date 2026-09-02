## 2026-09-02 · docs(event-hub): the offer gate does THREE jobs, and the code was never the stale half

**A correction to PR #5106 (EH4), which is merged and whose BEHAVIOUR is unchanged by this.** No
predicate moved, no gate widened, nothing shipped differently. What was wrong was what the new code
*said about* an existing predicate, and one missing observation in its tests.

### What was wrong

#5106's comments described `hubOffersAllowed` as *"STRICTER than the design text"* and as a
behaviour *"inherited, not chosen"* — framing the shipped code as a deviation from the design and
inviting a future session to relax it. That is backwards. `hubOffersAllowed(phase) { return phase
=== 'plan' }` is **correct as shipped and owner-ruled**, and its own docblock in
`lib/event-hub-control.ts` already named all three jobs that one line does:

- **(a) on the day** — an offer never outranks the day (design § 5.1 rule 3);
- **(b) after the day** — the row closes rather than sells: the **owner's ruling of 2026-08-21**,
  *"stop selling the day itself once the day is over"*, shipped three weeks before this stream and
  guarded since by `apps/web/lib/stop-selling-the-day-after-the-day.test.ts`;
- **(c) when the phase is UNMEASURED** — we do not know whether it is their wedding day, and an
  unread state must never become a sale.

**The DESIGN DOCUMENT was the stale half, not the code.** § 5.1 rule 3 read "never on the day"
alone; it has been corrected in the corpus to state all three cases.

🔑 **The lesson worth keeping: the docblock was read and the code was still called the deviation.**
When source and a document disagree, the document is the thing that rots — and a comment that calls
correct code "stricter than intended" is how a settled owner ruling gets relaxed by someone acting
in good faith six months later.

### What changed

- `apps/web/lib/event-hub-pro.ts` — the resolver's refusal list now names all three jobs, cites the
  2026-08-21 ruling and its guard, and says plainly: do not widen it, do not relax it to day-only,
  do not add a second gate.
- `apps/web/app/dashboard/[eventId]/launch/page.tsx` — the same correction at the call site.
- `apps/web/app/dashboard/[eventId]/launch/_components/hub-pro-offer-renders.test.ts` — **the third
  observation, which was missing.** #5106 proved the offer renders nothing on the day and after it;
  it did not prove the same for an **unmeasured** phase at the render. It does now, on both arms
  (null channel, and null phase with a channel present). One sabotage — forcing `hubOffersAllowed`
  to `return true` — turns all three red.

SPEC IMPACT: `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 5.1 rule 3 already corrected in the
corpus to state all three cases; no further corpus edit needed.
