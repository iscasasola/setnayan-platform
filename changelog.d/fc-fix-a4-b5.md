## 2026-11-25 · fix(guest): venue screens, the camera door and Papic's words say what happened (final check, area 4, batch a4-5-screens-and-words)

Final check fixer, area 4 (Guest), lane A batch `a4-5-screens-and-words`:

- `/live/screen`: a refused ownership read keeps the TV's last picture (`down`) instead of going dark as `locked` (A4-09).
- `/wall`: a failed snapshot read is a 503 the projector freezes on; a failed session read throws instead of showing the
  code form on a claimed TV (A4-15). An address that cannot be an event gets the quiet dead end, not the code form
  (A4-B07). The tab carries its own title, "Live photo wall", and is not indexed (A4-B06).
- `/panood/cam`: our own error is a retryable notice over the join form, never "This link isn't active", and a dead
  camera link is said on arrival (A4-10); the header pill reads the same link facts as the footer (A4-11).
- `/samahan/join`: a failed read says "We couldn't check this invite" with Try again; an unread member count is left out,
  never "0 members" (A4-12, A4-13).
- `/live` and `/wall`: the event's own word for its host, never "the couple" on every event type (A4-08, A4-16, A4-B06).
- The Papic demo counts from the server's `DEMO_SHOT_CAP`, never a typed `3` (A4-58), and never says Papic is unlimited
  (A4-56); `/papic/try` drops "the demo caps this, not Papic" (A4-83).

The same changes, line for line, are in #8325 (batch 3) and #8319 (batch 2), so the three merge together in any order.

Held by `apps/web/lib/screens-and-words-say-what-happened.test.ts` and `lib/papic-page-says-only-what-is-true.test.ts`.

SPEC IMPACT: None — honest-state and wording fixes under existing rules.
