## 2026-10-27 · fix(guests): a +1 with no name rides on their guest's invitation — never "Send to TBA"

Owner (DECISION_LOG 2026-10-27 "THE SEND RUN, REDRAWN SIMPLE"): the send run's first card read "+1 · TBA — Send to TBA".
`mayBeInvited` (the ONE invite rule) now leaves out an unnamed +1 seat (`ridesOnTheirGuest`, via `plusOneHasNoName`), so the
run, the To invite count, Setup's "Send to N" and Home's "Send N invitations" agree. Named, a +1 is invited like anyone. A
read without `first_name` never drops a seat. Guard: `lib/to-invite-is-one-rule.test.ts` (+1 test; sabotage red).

SPEC IMPACT: None.
