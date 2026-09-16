## 2026-09-16 · fix(papic): a per-guest limit is a ceiling, and three screens said it was a reservation

`papic_guest_spend_ceilings.ceiling_points` is a **ceiling** — the most one
guest may take. `papic_record_guest_capture` reads it, compares it against that
guest's own spend, and refuses her above it. That is the entire mechanism.

`papic_event_pool_status` — the function every capture path asks how much is
left — subtracts `papic_seat_allocations` from the shared pot and **nothing
else**. It has never read `papic_guest_spend_ceilings`. **No named guest's
number is held back for her.** Every credit comes out of the one pot, first come
first served.

Three surfaces said otherwise:

- `guest-allotments-choice.tsx` — *"Each guest has their own number of
  credits"*, *"Whatever a named guest does not use stays theirs"*, *"Credits you
  gave a named guest stay hers"*, *"everyone who comes gets at least one
  photograph"*;
- `studio/papic/page.tsx` — its own confirmation and error lines repeated two of
  those, one line away from the component that was being corrected;
- `papic-guest-capture.tsx` — on the guest's own phone, at the moment she is
  refused: *"This is the number the host set aside for you."* The surface where
  it costs most, and the last one found: it is written in the second person and
  shares no phrase with the couple's screen, so two greps of the console's
  vocabulary never reached it.

All three now describe a limit. `summariseAllotments` says *"capped at"* and
*"covered by no limit"* instead of *"gets"* and *"spare"*.

🔑 **The tell was already in the tree.** "Open the rest to everyone"
(`papic_guest_spend_ceiling_released_at`) only means something if something was
being held back. The control for releasing a reservation shipped; the
reservation did not — a mechanism fully present, cancelling itself, rendering as
nothing happened.

### The guard is keyed to the mechanism, not written down as a rule

`lib/a-limit-is-not-a-reservation.test.ts` reads the LAST migration that defines
`papic_event_pool_status` and, while it does not withhold for
`papic_guest_spend_ceilings`, forbids reservation language on all three
surfaces. **The moment somebody builds the withholding, the last test goes red
and says to put the copy back** — so this does not freeze today's weaker
sentence into the product.

Proven against a green control (8/8), five sabotages, each landing on exactly
one test: restore a banned sentence to the component (3) · delete the
explanation entirely, which passes every banned-pattern test (7) · restore it on
the console page (5) · restore it on the guest's camera (6) · make
`papic_event_pool_status` read `papic_guest_spend_ceilings` (8).

### ⚖ RULED BY THE OWNER, 2026-09-16 — "ceiling."

Asked whether the couple's numbers should reserve, he answered in one word.
**The number is the most a guest may take. No reservation is to be built**, and
his earlier phrasing — *"assign minimum shots per guest"* — is superseded.

So this is not a holding position: the corrected sentences are the product as
ruled. And the guard's last test changed meaning with that answer — making
`papic_event_pool_status` withhold now **contradicts a ruling** rather than
completing one, and its failure message says so.

⚠ **The lesson is not the answer.** Three screens had already answered — the
couple's sheet, the console's confirmations, and the guest's own phone at the
moment she was refused — while the owner had never been asked. **A screen that
answers an unruled question is not a placeholder; it is the product making the
decision.**

Inert today either way — 0 rows in `papic_guest_spend_ceilings`, 0 events with
the flag on — so nothing a couple can currently see changes.

SPEC IMPACT: Applied — DECISION_LOG.md row 2026-09-16.
