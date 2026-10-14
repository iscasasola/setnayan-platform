## 2026-10-14 · release(suppliers): batch 5 — the couple's Suppliers page, the supplier dashboard, the booking fee

One release branch joining fourteen finished draft PRs onto main 6f66c6ab3, merged `--no-ff`, parents first:
Suppliers page #6494 (Add your own) · #6505 (Build + the supplier's yes) · #6516 (Booked + Budget; carries #6439/#6441/#6449) ·
#6523 (date + place sheets, Help me choose, calendar truth) — supplier dashboard #6497 (S-PR0+1; supersedes #6443/#6450) ·
#6512 (Customers › People) · #6514 (Customers › Dates) · #6524 (Customers › Money) — booking fee #6506 (rules) ·
#6509 (free 5 counts sourced) · #6510 (launch offer) · #6511 (couple side) · #6507 (copy) · #6508 (admin flags).

Conflicts, each resolved keeping both sides' intent:
- Supplier Customers page (#6512/#6514 vs #6494): the "claimed record still asking" count #6494 added to the old month
  is SUBSUMED by #6514's Holding rule (`openAsksOf`: a pending OR accepted thread about an unbooked dated event) — a
  claimed couple's thread is opened `accepted` (`claimed-couple-is-a-customer.server.ts`), so it holds the date until
  the supplier's yes books a seat. #6514's page taken whole.
- Earnings page (#6507 edits, #6524 deletes): the live-rate wording moved onto Money's locked-year line
  (`money-segment.tsx` reads `getLiveBookingFeeSchedule()` only when the year is locked); the live-rate guard's reader
  list re-pointed from `earnings/surface.tsx` to `money-segment.tsx`.
- `one-commission-promise.test.ts`: Money's two files (S-PR4) AND the waitlist page leaving the list (#6507).
- `/vendor/claim/[token]`: #6494's claim door perks + #6507's live schedule.
- `booking-fee-notice.tsx`: both imports; the "Setnayan introduced this couple to you on …" line (#6494, answer 11)
  is also drawn on Today's hairline bill row (#6497's `line` variant), not only on the boxed one.
- `promo-free-windows.ts` (#6510 vs main's settings cache), `floating-rows-are-glass.test.ts`, `details-lab-node.tsx`:
  both sides kept.

Owner ruling on the batch's questions (DECISION_LOG 2026-10-14 🧾), applied here: the shared workspace door
(`DisputeLinkButton`, was "Request refund / dispute") and the Booked row's verb (#6516, was "Dispute") both read
exactly **"Report a problem"** — same action, same disputes flow. Guards re-pointed in `lib/booked-rows.test.ts`
(the row label + a new check that the workspace door says the same words, opens the same flow and never promises a
refund); sabotage: each old wording restored → RED. Every other question ships with its member's default.

Then `main` once more (f25972b66, Event Hub batch 4 #6526): `app/_components/counter.tsx` was added on both sides —
#6514's form Counter and #6520's approved seat-plan Counter (kind 17). Main's drawing is THE Counter
(`lib/the-counter-is-one-drawing.test.ts`); the supplier's Dates post through a new `app/_components/form-counter.tsx`
that keeps the form's number and draws that one Counter (Dates guard §7 re-pointed; sabotage: a copied pill → RED, the
self-save wait broken → RED). The Suppliers b3fix (44-px reach, live Build count) joined with #6494's "Add" label
(`find-thumb-row`, `every-press-reaches-44` guard re-pointed) and #6505's lab shell (live count on Find; the Build tab
keeps its body's count).

Fixes from the two batch-5 lab walks (2026-10-14), each with a guard that went red without it:
- **W1** Booked › Budget: a partial read whose floor is ₱0 (the supplier money refused) reads Owed "—", never "₱0+"
  (`lib/booked-budget.ts`; `booked-budget.test.ts`).
- **W2** the date sheet says "held by …'s booking" only of the day the booking holds (the LIVE date) — never of a drafted
  day (`dateLadder` + `DateSheetData.bookedDay`; `help-me-choose.test.ts`).
- **F (live wrong)** the overdue booking-fee sentence now states the lock the gate enforces: `feeEnforcementSentence` and
  `feeDueCopy` take `enforced` (required, no env default), and every shipped caller passes `resolveFeeEnforcement()`
  (env flag OR `platform_settings.fee_unlocks_event_enforced`) — production's switch is TRUE, so suppliers stop reading
  "not affected" while locked (`lib/the-fee-sentence-tells-the-lock.test.ts`).
- Customers People · Dates · Money are 44-px boxes (`h-11` beats the shared pill's `min-h-[38px]`; `people-is-rows` 3d).
- A Booked row whose payment is past due says "was due Oct 5" in the danger colour, by the Pay sheet's own rule
  (`late` on `BookedNext`, one clock for the row and the sheet; the lab takes `&today=`; `booked-rows.test.ts`).

Supplier-needs audit F9 (2026-10-14): after Agree, a yes that leaves a billed, unpaid booking fee no longer tells the
supplier "The couple has been told" — the couple's news is HELD until the fee settles (#6511). The supplier now reads
"You said yes. Pay the booking fee and we'll tell the couple their booking is confirmed." The redirect's `&fee=held`
is written from the SAME `feeBilledUnpaid` that holds the news back; Today, the customer card and the thread read it
(`lockAgreeFeeHeld`); the thread draws a "Pay the booking fee" door to /vendor-dashboard/booking-fees, Today and the
card already draw the new bill with its Pay. Guard `lib/the-yes-says-what-the-couple-heard.test.ts` (sabotage 2/2 RED).

Generated files regenerated against the join (never hand-merged): ugat screens, root-map baselines, no-card baseline,
port-control baseline, exposure-surface baseline (PGlite replay), admin jobs + admin routes.

Each member keeps its own fragment; this one only records the join.

SPEC IMPACT: None (each member's own fragment carries its spec impact).
