## 2026-09-29 · feat(rsvp): the selfie is asked only of a guest who wants to be tagged

Owner, verbatim: *"only if the want tagging service. if the do not click tagging
service. no selfie needed"* → *"it should only depend if they want to be tagged"*.

- The Event Hub reply card now asks one plain question first — **"Want to be
  tagged in the photos?"** · *Yes, tag me* / *No thanks* — and the selfie sits
  behind its Yes (CSS-only `:has()` reveal, `.tag-yes-reveal`; still a server
  component). No answer ticked → no selfie. No → nothing more is asked. In
  one-at-a-time mode the question and the selfie are two sibling steps.
- New nullable `guests.face_tagging_wanted` (migration `20271253758764`): NULL
  never answered · TRUE yes · FALSE no thanks. Written by `submitRsvp` and the
  new `recordFaceTaggingWish` (cookie-authenticated, service role).
- `submitRsvp` refuses any selfie that still rides along after a "No" (a hidden
  input still posts). The consent gate is otherwise untouched — narrowed only.
- The day-of catch (the camera's face step, `DayOfFaceEnroll`) honours the
  answer: a stored No is never asked again; a guest who never answered is asked
  the same one question before any selfie; "No thanks" also retires the
  in-camera prompt. Gated by `dayOfFaceCatchShows` (lib/face-tagging-wish.ts)
  in both parents (hub loader, `/papic/guest`).
- The couple's existing face-tagging decline now also puts the question to no
  guest (`resolveFaceTagging().askable`), and the Papic guest camera — which
  chose its face mode without the couple's decline — honours it too.
- Guards: `the-selfie-waits-for-a-yes.test.ts` (11 tests, sabotage-checked);
  `silent-absence.test.ts` re-pinned to the new needsFaceEnroll shape.

SPEC IMPACT: DECISION_LOG.md row 2026-09-29 "THE SELFIE IS ASKED ONLY OF A GUEST
WHO SAYS THEY WANT TO BE TAGGED" (applied directly in the corpus). Open owner
question recorded there: should "No thanks" after a selfie was already given
also withdraw it (today withdrawal stays its own explicit button)?
