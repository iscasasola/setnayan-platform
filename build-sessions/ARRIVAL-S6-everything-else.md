# ARRIVAL S6 — a home for everything else

**Model:** Sonnet 5 · **Effort:** high · **Open a NEW session and paste ARRIVAL-COMMON.md first, then this.**

## The problem
About twenty-five guest-facing things exist — Pakanta song requests, Pabuya blessings, Alaala
keepsake, walk-the-room 3D, find-my-table, print, share, the selfie cam, challenges, the entourage
page. Most have no home on the invitation, which is why the page reads as a scroll rather than a
hub.

## The delta
One "everything else" sheet (design board 6), grouped ON THE DAY / ANYTIME / AFTER, each row one
line, each row only shown when that feature is actually available to this guest.

· INVENTORY FIRST, from the code, not from memory. List every guest-facing route under
  `app/[slug]/` and every feature door in `site-body.tsx`; put the list in your PR body.
· A row that is not available must not render as a dead door. Say "opens 18 December" or omit it.
· Do not duplicate what the menu bar already resolves — extend the menu's own slots if that is
  where a row belongs.

## When to start
**Start NOW, alongside S4.** Your sheet and its row-resolver are new files; only the mount line
touches shared ground.

⚠ `site-body.tsx` is a 4,100-line file all three arrival slices touch. Keep your diff in it to the
MOUNT LINE, rebase on `origin/main` right before you push, and redo your mount on the merged tree
rather than forcing.

## Fence
One new sheet component + its pure "which rows for this viewer" module. Do NOT touch the RSVP
surfaces, the day-of branch, or `lib/arrival-action.ts`.

## Handback
The PR number, the full inventory, and which rows you could not verify.
