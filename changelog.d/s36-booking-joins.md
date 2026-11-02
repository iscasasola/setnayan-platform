## 2026-09-18 · fix(booking): three booking-lifecycle orphans get their other end — the dispute counter asks the database, LockedState gets its first mount, the pinned quote card is deleted (S36)

Second half of S36's sweep of the booking-lifecycle tier in S26's both-ends
baseline (`apps/web/tests/db/ugat-both-ends.baseline.txt`, PR #5625). The first
half (migration `20271234094457`) retired the ends nobody needs; this one joins
the ends somebody does.

- **`count_vendor_disputes_30d` gains its caller — and becomes the count that
  demotes.** The dispute-counter cron found candidates with a TypeScript scan
  whose predicate was kept "byte-aligned" with the SQL helper by hand, and then
  demoted on the scan's number. Two mechanisms for one fact (CLAUDE.md RULE 0
  §8). The cron now asks the SQL function for each candidate before writing;
  the database's count is the one in the audit row and the email, a disagreement
  is logged rather than folded, and a non-count from the RPC is recorded as a
  fault, never demoted on. The decision lives in `lib/dispute-demotion.ts` as a
  pure function with an executable test, plus a source guard that the route
  calls the RPC exactly once, before the write, and reads its error.
- **`LockedState` is mounted.** State 04 of the six-state design system shipped
  in August and no paid gate ever used it; every gate drew its own grey box.
  The payment-links gate on Payment options (a Pro & Enterprise feature) now
  renders the gold frame with the same words plus the one thing the grey box
  lacked: a "See plans" step to the subscription page. No price is written.
  Fixed a `text-terracotta-700-700` class typo in the frame on the way. Guard:
  `locked-state-is-mounted.test.ts`.
- **`thread-quotations-card.tsx` is deleted**, with `lib/thread-quotations.ts`
  and its test (no other importer). The quote moved INTO the conversation in
  #5584 (owner: *"place the quotation inside the chat box"*); the card had been
  unmounted since, and the existing guard that it is never mounted again stays.
  `reads-are-honest` narrows its list to the two cards that still exist;
  `port-control-baseline.json` regenerated.

SPEC IMPACT: None.
