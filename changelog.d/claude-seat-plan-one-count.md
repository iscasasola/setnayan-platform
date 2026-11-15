## 2026-11-14 · fix(seating): the empty floor's draft step says the top row's count, and why it differs (RW-304b)

Live on #7683: the empty floor's "Build my seating draft" read "Seat your 4 guests" while the top row read "6 unseated".
Both were true. The row's Unseated counts everyone coming without a seat — the couple too — and the draft
(`computeAutoSeat`) seats everyone coming except the couple's own roles (`roleSet.coupleRoles`), who choose their own table.
The step now counts with that same couple rule (it hard-coded bride/groom and ignored seats) and, when its number is not
the row's, says so: "Seat 4 of your 6 unseated by role — you two pick your own table". One number when they match.
`starterDraftHint` in `lib/seat-plan-details.ts`; held by `lib/the-starter-step-counts-like-the-row.test.ts`. No new look.

SPEC IMPACT: None.
