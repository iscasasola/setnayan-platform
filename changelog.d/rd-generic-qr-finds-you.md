## 2026-09-30 · feat(join): the generic QR finds you — the last 4 digits of your mobile let you straight in

Only on an "Anyone, I approve" event (the generic QR). A signed-out person at
the ask-to-join door now types their name FIRST, alone (the five boxes). The
server looks for EXACTLY that person on the couple's list (`lib/find-me.ts`:
First + Last must equal; Middle and Suffix must equal when typed; prefix never
compared; case, spacing and accents ignored), among rows the couple put on the
list — never a couple seat (bride · groom · celebrant, primary or extra role),
never a pending request, never a seat an account already holds, never a
removed or passed-away guest.

- **One match with a mobile** → "We found you!" asks the last 4 digits of that
  mobile. Nothing else is shown first. Correct → the guest's own redeem hop
  (`/{slug}/redeem?…&token=<their key>`), byte-for-byte what their personal QR
  does — this door mints no session of its own. Wrong → "That doesn't match"
  (never which part). Tries are spent before the digits are compared: 5 per
  guest (all connections together) and 10 per connection per event, per 15
  minutes, on the existing durable limiter (`lib/with-rate-limit.ts` →
  `rate_limit_hits`, which is also the attempt log, plus a `[find-me]` log line
  with no digits and no name). Out of tries, or "I don't know that number" →
  the couple confirms them.
- **One match with no mobile, or several** → "We found you! {The couple} will
  confirm it's you." → the ordinary request, with the name as found; Guest List
  → Requests now shows the exact-name guest as the match first, so the couple
  taps Link once.
- **No match** → the ask-to-join form, unchanged (name prefilled).

What the door answered lives in one 15-minute httpOnly cookie that is
ENCRYPTED (`sn_find_me`, `lib/find-me.server.ts`) — never in the address, and
it opens nothing. Name look-ups are budgeted too (20 per connection per event
per 15 min); past that the door just shows the form.

Guarded by `apps/web/lib/find-me.test.ts` (rules executed + five door pins:
nothing before the check · couple rows never found · tries spent first, per
connection and per guest · redeem hop only · no-mobile → pre-matched request).
`lib/seat-links-only-on-purpose.test.ts`'s claims-page select pin now allows
the two added name columns (the role columns it guards are still required).

Not covered: a SIGNED-IN person on the join door still gets the full request
form (the name-first step is the signed-out generic-QR arm only).

SPEC IMPACT: None — implements DECISION_LOG 2026-09-30 "THE GENERIC QR FINDS
YOU" as recorded; no decision changed.
