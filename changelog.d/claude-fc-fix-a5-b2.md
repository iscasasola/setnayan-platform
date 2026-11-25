## 2026-11-25 · fix(supplier): failed reads say "couldn't load" on twelve area-5 screens (final check area 5, batch 2)

- Albums by event, Partnerships (count, partner names), Repertoire (set list, library), Recommendations (every
  read), Who gets new inquiries, Track record, Today and its service maker now say a refused read with Try again
  (`ReadFailedNote` / `ReadFailedBody` / `ToolFail` / `ErrorState`). They no longer show an empty list, "(0)", a
  raw id, "Set up your supplier profile first" or a bare apology.
- The couple's QR landing (`/vendor-invite/[slug]`, also `/{shop}/invite`): a refused shop read is "Couldn't open
  this supplier just now", not "not found". A refused events read is said, not "Create your event first".
  `listHostEvents` still fails closed for the claim action; the page reads the new `readHostEvents`.
- Claim finalize: a refused card count no longer sends a shop to "make your first card".
- Fit check: a refused calendar read is "Couldn't check your date", never "Free on your date".
- Claim dead ends ("already claimed", "no longer active") carry a Message us door instead of "contact support".
- New route builders: `routes.vendorDashboard.recommendations`, `.trackRecord`.
- Guard: `lib/supplier-reads-say-couldnt-load.test.ts`.
- Findings: A5-G6-01 A5-G6-05 A5-G6-06 A5-G6-11 A5-G6-10 A5-G5-08 A5-G5-06 A5-G1-09 A5-G1-13 A5-G1-14 A5-G2-06
  A5-G1-11. Skipped 🟠 A5-G4-01 (the payment cap's ruled default is a money rule).

SPEC IMPACT: None. No amount, plan or rule changes; only how a failed read shows.
