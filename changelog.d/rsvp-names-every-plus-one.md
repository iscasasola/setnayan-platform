## 2026-09-29 · feat(rsvp): every plus-one is named — one short set per seat, one "Filling in for ▾" switcher

Owner, verbatim: *"plus guests are only minimum questions. they don't need to
recommend songs and notes to the couple. They also get their own QR Code. they
can also link it to their account. Second, they can have 1-4 pluses. so there
needs to be a way to write their names in a simpler way. like a toggle on which
guest they are editing."* — then *"adding +1-4 should be a host decision. and
their QR auto adapts to it?"*

- The RSVP's "Who are you bringing?" block moves into its own file
  (`app/[slug]/_components/rsvp-plus-ones.tsx`); `rsvp-widget.tsx` only mounts it.
  One set per seat the host gave (1–4): first name, last name, meal, dietary —
  no song, no note, no selfie. Meal/dietary obey the couple's same ask switches.
- One switcher, the shared `PickMenu`: "Filling in for: Ben Reyes ✓ ▾", unnamed
  seats read "Guest 3 · not named yet". Switching hides, never unmounts, so
  nothing typed is lost and every seat posts. One-question-per-screen keeps the
  block as ONE step. Opens on the first unnamed seat.
- `submitRsvp` writes each seat's meal/dietary on THAT seat's row; a blank name
  on an existing seat saves its meal/dietary and leaves its name alone (new
  `details` op in `planSeatNames`); a re-send names the same rows; nothing is
  ever deleted from the guest side; no seat beyond the host's count is minted.
- The host's count is read at render, so the same link adapts live. A count
  lowered below the named seats never drops a named person from the reply
  (`plusOneNameSlots`): named seats + empty boxes only up to the count.
- The seat reads (site loader, reply door) carry each seat's first/last/meal/
  dietary so a Send never overwrites a meal the plus-one gave on their own key.
- "Your guests" labels an unnamed seat "Guest N" (was "Seat N"), matching the
  prototype `prototypes/rsvp_plus_ones_2026-09-29.html`.

Guarded by `app/[slug]/_components/every-plus-one-is-named.test.ts` (15 tests,
each property sabotaged and seen to fail). `a-guest-can-name-who-they-bring`'s
window widened to still reach the end of the grown write.

SPEC IMPACT: DECISION_LOG.md row "AS BUILT — EVERY PLUS-ONE IS NAMED" (2026-09-29).
