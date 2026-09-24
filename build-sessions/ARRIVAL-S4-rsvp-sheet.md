# ARRIVAL S4 — the RSVP is a sheet, with the invitation still behind it

**Model:** Opus 5 · **Effort:** high · **Open a NEW session and paste ARRIVAL-COMMON.md first, then this.**

## What ships today
The RSVP is a section in the page's flow (`plan.rsvpShouldRender`, the № 07 widget). Answering
means leaving the invitation and scrolling back.

## The delta
A half sheet over the invitation, the iOS convention every event app in the research uses: the
mark stays visible behind it, the two answers are the only accented things, and the details —
who you are bringing, meal, a note — are rows inside the sheet.

· Keep ONE RSVP mechanism. Do not fork the action; the sheet posts what the section posts.
· The sheet is reachable from the arrival action (`lib/arrival-action.ts`, shipped) and from the
  status card. Both must land in the same place.
· Closing the sheet must not lose a half-typed note.
· A guest who has already answered opens the same sheet showing their answer, not a blank form.

## When to start
**Start NOW, first.** You own the RSVP surfaces and nothing else does.

⚠ `site-body.tsx` is a 4,100-line file all three arrival slices touch. Keep your diff in it to the
MOUNT LINE and put the work in your own component. Rebase on `origin/main` right before you push;
if another slice merged first, redo your mount on the merged tree rather than forcing.

⚠ Keep the anchor `SITE_MENU_ANCHORS.me` on whatever section the RSVP lives in — the shipped
arrival action links to it, and a fragment link to a missing id fails silently.

## Fence
`app/[slug]/_components/` RSVP surfaces and one new pure module for the sheet's open/close state.
Do NOT touch `lib/arrival-action.ts`, the venue gate, or the dress-code widget — other sessions
own those.

## Handback
The PR number, what a real guest would see, and the ONE thing you could not verify.
