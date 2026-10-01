## 2026-09-30 · fix(rsvp): a guest answers yes or no — the middle answer is not offered

Owner, verbatim: *"for now. let us fix the RSVP remove the maybe"*. Every place a GUEST answers
attendance now offers only **Joyfully accepts** / **Regretfully declines** (a wake keeps "Will be
there" / "Unable to come"): the RSVP card (`app/[slug]/_components/rsvp-widget.tsx`, which is also
the `/[slug]/invite/reply` card and the one-question-per-screen layout) and the ask-to-join form
(`REQUEST_ANSWERS`, `lib/guest-requests.ts` — a posted `maybe` is refused as `missing_answer`).
`submitRsvp` refuses a NEW `maybe` from a guest before anything is written and sends them back with
`?rsvp=choose` ("Please choose whether you will be there — yes or no…"), rendered on both `/[slug]`
and the invite Reply door. A guest ALREADY saved as `maybe` keeps the row: nothing is preselected on
their card, the answer is required so Save cannot post it empty, and an unchanged `maybe` reposted by
the missing-details card still saves. The column, its CHECK and the couple's Guest list tools
(which still see and set `maybe`) are untouched. Guard: `app/[slug]/_lib/a-guest-answers-yes-or-no.test.ts`
(11 tests, 7 sabotages each turned it red); `the-reply-is-a-sheet.test.ts` now expects two answers.

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-30 "RSVP — GUESTS ARE OFFERED YES OR NO (FOR NOW)" — records the interim state under the existing "THE MIDDLE ANSWER IS OPTIONAL" row.
