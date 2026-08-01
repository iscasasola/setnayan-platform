## 2026-08-01 · chore(guests): remove `households` — the one-invitation-per-family feature that was designed in and never built

Owner, after asking what it actually was: **"just remove it."**

### What it was for

Group the guests who live together into one household with one postal address, so the couple posts **one envelope** to "The Reyes Family" while the headcount still counts five people. Philippine wedding invitations very often go to a family rather than a person, so it was a sensible thing to design.

It shipped on **2026-05-13** in the very first guest-list migration — the same one that created `guests`, the Filipino role enum (ninong, ninang, veil sponsor, coin bearer), the RSVP statuses and the per-guest QR token. It was designed in from day one.

### Then it was never built

Eleven weeks later: **0 households ever created · 0 of 39 guests linked · no screen · no query.** The couple would have typed the family name and address themselves — it was a label, never an inference — and no surface to type it into was ever made.

### ⚠ It was NOT unreferenced, and the first attempt broke ten security assertions

A reference scan that excluded `*.test.*` reported it dead. `households` was a **canary** in `event-member-self-join.db.test.ts` — the suite proving a stranger who self-joins an event cannot read that event's data seeded a household row and asserted the attacker could not read it back. Dropping the table took the suite from 10/10 to 0/10.

**The canary moved to `guests`,** which is the same event-scoped, couples-write, RLS Pattern B shape and actually carries names. The assertion is now **stronger**: it previously proved only that a stranger could not read a table which would always be empty.

### And the denial had no positive control

Every assertion in that test is *"the attacker read 0 rows"* — which passes just as happily when the row was never seeded. There was no check that the targets existed.

This PR adds one, covering **all three** targets (event, guest roster, harassment report), not just the one I touched. The gap predates this change; swapping the canary is what surfaced it.

### Recorded

The Ugat baseline line is removed with the table, and the Person node's annotation now says it was dropped and why — it had already been corrected twice (first "part of the person spine", which reading the FKs disproved; then "product-dead but undroppable", which the canary swap resolved).

Verified: migration guard green (1015) · **full DB suite 699/699** (up one — the new anti-vacuity control).

⚠ **Local `tsc` was not run to completion** — it SIGKILLs at 12 GB on this machine, a known limit here rather than a signal about this change. The changed TypeScript is one test file; CI's typecheck is a required check and gates the merge.

SPEC IMPACT: None — an unbuilt feature's schema removed. If guest grouping is wanted later it gets a fresh design; it will not be built on a table nobody wrote to for eleven weeks.
