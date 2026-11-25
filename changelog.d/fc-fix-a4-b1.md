## 2026-11-25 · fix(guest): the guest sub-pages say a failed read instead of a false fact (final check, area 4, batch 1)

Final check fixer, area 4 (Guest), lane A batch 1. Each fix makes a failed database read reach an honest state
(the guest error boundary or a plain "couldn't" line), where it used to be drawn as a fact about the guest or
the hosts:

- `/[slug]/seat`: an unread table list no longer says "the floor plan is on its way" (A4-50); the seat gate
  throws on a failed read instead of "seats show on the day", on the day (A4-51); no price in a comment (A4-53).
- `/[slug]/find-seat`: an unread check-in no longer says "Show this at the door" as if arrival were checked (A4-37).
- `/[slug]/welcome`: only known `?error=` keys draw a message (A4-27); a failed read in the save stays on the door
  with "Your details did not save" (A4-26); an unread inviter keeps the whole phrase, never "from the …" (A4-25).
- `/[slug]/avatar`: a failed guest read throws instead of redirecting as "no guest" (A4-28).
- `/[slug]/pabuya`: an unread list of ways to give throws instead of "hasn't set up e-gifts yet" (A4-44).
- `/[slug]/print`: a failed event read is no longer a 404 (A4-45); the story reads no longer fall back to "not
  ready yet" or the automatic layout (A4-46).
- `/[slug]/request`: a failed request-key read throws instead of sending the requester away as a stranger (A4-49).
- `/[slug]/invite` and `/join/[eventId]` (join flow): its three reads throw instead of drawing default questions,
  the form for a member, or a second form for someone who already asked (A4-38).

Held by `apps/web/app/[slug]/guest-sub-pages-say-a-failed-read.test.ts`; `lib/request-key.test.ts` pins the new
read call.

SPEC IMPACT: None — honest-state fixes under the existing rule (CLAUDE.md §5 rule 4); no screen, price or rule changes.
