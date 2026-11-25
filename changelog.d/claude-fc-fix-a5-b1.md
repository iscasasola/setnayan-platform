## 2026-11-25 · fix(supplier): a refused plan read is said, never "Free" or a lock (final check area 5, batch 1)

- New `readVendorTier` (`lib/vendor-feature-gate.ts`): the one reader of a shop's plan for screens. Same read and
  same admin-deal promotion as the gates, but a refused or missing row is `'unread'`. `resolveVendorTier` is rebuilt
  on it and still fails closed to `free` for gates and server actions.
- The rail reads it (one reader, promotion applied) and draws "—" for an unread plan. The lapse sweep still asks
  about the stored plan.
- Creators, Theft Watch, Deep Search (plan, history, each search's state), Your page, the card maker's "Add the
  first space", Your details' "Where else you show up" and Share your work now say "We couldn't load …" with Try
  again (the shared `ReadFailedNote` / `TemplateFail`) instead of a plan ask, a lock or a silent gap.
- Team: a refused extra-seats read is said ("couldn't read your extra seats"), never "0 added" or a smaller cap.
  The invite action still fails closed.
- Guard: `lib/vendor-tier-read-is-honest.test.ts` (behaviour on a stubbed client + the wiring of every screen).
- Findings: A5-G2-01 A5-G2-02 A5-G2-03 A5-G6-13 A5-G6-14 A5-G5-04 A5-G5-03 A5-G3-02 A5-G5-05 A5-G4-11 A5-G5-02.

SPEC IMPACT: None. No amount, plan content or rule changes; only how an unread plan shows.
