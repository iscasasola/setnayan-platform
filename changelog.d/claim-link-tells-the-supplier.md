## 2026-11-02 · fix(claim): a supplier who joins from a couple's link is told they wait, told the answer, and let in

Owner 2026-11-02, "THE MINIMUM TO LET SUPPLIERS IN" (joining from a couple's QR / claim link "lands linked to that event"); supplier gate audit G3 + G4.

- **Told they wait** — Today shows "Waiting for <event> to let you in" for each of the supplier's own pending claim asks (`lib/claim-access-wait.ts`, `readClaimWaits`, `_components/claim-wait-lines.tsx`). A failed read says so.
- **Told the answer** — the couple's Approve / Decline sends the supplier one in-app notice, new type `claim_access_answered` (enum migration `20271302590530`; push level normal; not on the email allowlist). Approve opens their client page.
- **Let in (G4, walked in the DB)** — with "the fee unlocks the event" on, a claim approval booked the hand-added row with NO charge, so the supplier the couple had just approved was `booked_fee_due` and their brief came back withheld. The approval now makes the fee through a new mint door `claim_approved` (ordinary rules: a supplier the couple brought is `waived_import`, nothing owed), and the catch-up sweep re-makes it for approvals already given (e.g. the founders' event).
- Guards: `lib/a-claimed-supplier-is-told-and-let-in.test.ts`, `tests/db/a-claimed-supplier-lands-unlocked.db.test.ts`; `booking-fee-single-trigger.test.ts` lists the new door.

SPEC IMPACT: A new fee door is a ruling about when a supplier's fee is made. Chosen: the existing attribution rules decide (import → waived; Setnayan-introduced → sourced, first five waived), the audit's first option. Flagged for the owner in the PR.
