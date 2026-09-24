# ARRIVAL S5 — on the wedding day, the page rearranges itself

**Model:** Opus 5 · **Effort:** high · **Open a NEW session and paste ARRIVAL-COMMON.md first, then this.**

## What ships today
`/[slug]/hub` is the day-of hub (panels: Now · Watch · Camera · Photos · Me · Schedule ·
Directions, five primary + More). The INVITATION itself barely changes on the day: the arrival
action switches to "Show your pass" (`lib/arrival-action.ts`, shipped) and a day-of banner appears.

## The delta
On the day, the invitation leads with what a guest needs in the room: what is happening now, their
pass, the camera. The planning rows step back. The design board is "5 · On the day".

· 🕐 The day is MANILA's day — `manilaToday()`. This is the slice most likely to be wrong by eight
  hours; a test must state the 00:30-Manila instant explicitly.
· REUSE the hub's resolvers. A second definition of "what is happening now" is the defect.
· A guest who declined is not given a door pass.
· Nothing here may gate on the booking fee: guests are not gated.

## When to start
**Start LAST — after PR #5783 has MERGED.** You read `lib/arrival-action.ts`, which ships in that
PR; starting earlier means building against a file that is still moving. Check with
`gh pr view 5783 --json state`.

⚠ `site-body.tsx` is a 4,100-line file all three arrival slices touch. Keep your diff in it to the
day-of branch, rebase on `origin/main` right before you push, and redo your edit on the merged tree
rather than forcing.

## Fence
The day-of branch of `app/[slug]/_components/site-body.tsx` and `app/[slug]/hub/*`. Do NOT touch
the RSVP surfaces (S4 owns them) or `lib/arrival-action.ts` beyond READING it.

## Handback
The PR number, which timezone resolved the day, and what you could not verify.
