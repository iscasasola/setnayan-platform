# HANDOVER — rd/grandparents-role (2026-10-17)

Task: owner-approved GRANDPARENTS ROLE (`bride_grandparents` / `groom_grandparents`), Parents' twin.

Done (committed): migration 20271271089555 (enum ADD VALUE only); roles in guests.ts (type, labels, inner circle),
role-sets (offered + tier1, wedding + muslim), role-groups (vip_family + importance), bulk vocabulary, role-seating,
emcee order, attire figures, mood-board palette key, guest-search aliases, editorial voices + family tree;
entourage `grandparents` group after Parents (roleFirst), per-person words via `parentBesideOne` + `KIN_OF_ROLE`;
`joinsSavedOrderAfter: 'parents'` puts Grandparents after Parents in a pre-existing saved section order; guard
`apps/web/lib/grandparents-are-never-immediate-family.test.ts`; changelog fragment; lab sample re-picked.

Decisions taken by the builder (record): grandparents are NOT self-claimable (VIP-family rule); guestbook voice =
parents' weight; Auto Arrange label "Immediate family (both sides)" unchanged (grandparents join that set).
Corpus: DECISION_LOG row appended but NOT committed (the file holds another session's uncommitted edit).

Done: guard 9/9; sabotage S1 6, S2 2, S3 5, S4 1, S5 2 (of 9) red; 102 touched test files 914/914.
Next: ugat db-tests, shots at 375, push, draft PR.
