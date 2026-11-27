## 2026-11-25 · fix(guest): the guest's link doors say what happened (final check, area 4, batch 3)

Final check fixer, area 4 (Guest), lane A batch 3 — the doors a guest, crew member or venue screen reaches by link:

- `/claim/[token]`: a failed read says "we couldn't check this link", never "isn't active" (A4-03); the godparent
  records' move is checked and retried once, and a failure is told instead of the plain success (A4-04).
- `/join/[eventId]/connect/confirm`: the email branch of `findSeatToConnect` binds only a row the couple put on the
  list (`emailMayBindRow`), so a pending REQUEST is never offered as a seat before the hosts press Keep or Link (A4-06).
- `/join/[eventId]/set-password`: "Skip for now" (and Save) fall back to the join door, which routes each role home —
  never the host's dashboard, a 404 for a guest (A4-B09).
- `/join/crew/[token]`: every closed crew door offers one way on; "couldn't reach" doors offer Try again (A4-B02).
- `/live`, `/wall/[eventId]`: the event's own word for its host, never "the couple" on every event type (A4-08,
  A4-16, A4-B06). `/live/screen`: a refused ownership read keeps the TV's last picture ("down") instead of going dark
  as "locked" (A4-09; `readBroadcastWindow`). `/wall`: a failed feed read is a 503 the projector freezes on, never an
  emptied wall; a failed session read is not "unclaimed" (A4-15); an address that cannot be an event gets the quiet
  dead end, not the code form and a "hiccup" (A4-B07).
- `/panood/cam/[token]`: a dead camera link is said on arrival, not after a sign-in (A4-B03); our own error is a
  retryable notice with Join still there (A4-10; `lib/panood-camera-claimability.ts`); the header pill reads the same
  link facts as the footer and never says "Connected" over a failed link (A4-11; `cameraPill`).
- `/samahan/join/[token]`: a failed read says "we couldn't check this invite" with Try again (A4-12); an unread member
  count is left out, never "0 members" (A4-13).

Held by `apps/web/lib/guest-doors-say-what-happened.test.ts`; `venue-screens-need-live-studio.test.ts` pins the new
read (and that a refused read is `down`).

SPEC IMPACT: None — honest-state, wording and guard fixes under existing rules (CLAUDE.md §5 rule 4; DECISION_LOG
2026-09-26 "a request is never a way in until the hosts press Keep or Link").
