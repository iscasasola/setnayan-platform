## 2026-09-10 · fix(chat): a Deal with no quoted price can no longer be locked

A Deal struck in chat before the supplier sent a formal quote has no base
total. The card still offered "🔒 Lock this deal"; pressing it booked nobody,
stamped the Deal locked, froze the thread at a NULL agreed price, sent the
supplier "Couple accepted: Deal locked", and the card then read "Price agreed
and frozen at this amount." Both people were told it was locked while no price
was saved and nobody was asked to take the booking.

- **One rule, asked by both the card and the action** —
  `lib/deal-lock-readiness.ts`: a Deal is lockable only with a quoted base
  price plus its changes, not below zero.
- **The card** shows no Lock button on an unpriced Deal. The couple reads
  "This deal has no quoted price yet, so it can't be locked. Ask <shop> to send
  their quote first, then agree the deal on it."; the supplier reads "…Send your
  proposal first…". The Lock button now always carries its price.
- **`lockDeal` refuses before any write** (no booking, no stamp, no freeze, no
  "Deal locked" notice) and the couple gets an error toast saying nothing was
  locked — the backstop for a stale page or a replayed form. The booking call no
  longer needs its own null-price skip, because the refusal sits in front of it.
- **The freeze line** (`lockFreezeLine`) now takes a REQUIRED `priceFrozen`;
  with no price it says "No price was saved with this deal, so nothing is frozen
  here" in every handshake state, never "frozen at this amount".
- The handshake (`vendor_agree_to_lock`), the shared lock core and the budget
  files are untouched. No migration.
- Guard `lib/a-deal-without-a-quote-cannot-lock.test.ts` (8 tests): the rule by
  behaviour, the words, and the wiring — the Lock-form file set is DERIVED by
  scanning app/, and `lockDeal`'s refusal must precede the booking, the stamp,
  the freeze and the notice. 9 mutations, each landed (needle 1→0) and each RED.
- Production at build time: 1 chat thread, 0 locked threads, 0 Deals — nothing
  to repair.

SPEC IMPACT: `Test_Script_Live_Two_Sided_2026-09-10.md` step 5 now states the
exact line each side sees; `DECISION_LOG.md` row 2026-09-10 (a Deal can be
locked only on a quoted price).
