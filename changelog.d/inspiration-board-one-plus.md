## 2026-11-18 · feat(inspiration): one + per part on the inspiration board

The couple's inspiration board (Suppliers › Find › "Your inspiration board", and Studio › Mood Board) drew 87
identical + boxes — 29 parts × 3 (walker W4-S1/B8). Built to the owner-approved drawing "Inspiration board: one +
per part" (all six picks approved 18 Nov):

- each part is ONE row: name, "1 of 3" / "3 of 3 · full", its photos, and ONE + that opens the phone gallery /
  file window directly, several photos at once; picking more than the free spots keeps the first ones and says so;
  a photo that did not upload stays as **Retry** and the row says how many saved; a full part has no +;
- the groups fold — Venue & feel open, Palette and Dress codes folded with a count (shared `Fold`);
- tap a photo opens the shared photo viewer (Remove · Done; on a phone a "Move to another part" dropdown —
  a computer keeps drag); swipe a photo left removes it with the Undo toast, no confirm (`deleteWithUndo`);
- the tiny × on each photo is gone; "Browse supplier photos" stays under its part; the how-to moved into the ⓘ
  beside the sheet title.

No schema change, no new server action (reuses `uploadMoodboardSlot` · `removeMoodboardSlot` ·
`reorderMoodboardSlot`); the 3-per-part cap is unchanged. Lab: `/dev/inspiration-board-lab` (dev only).
Held by `inspiration-board-one-plus.test.ts`.

SPEC IMPACT: None — builds an already-approved drawing; no decision changed. (The ⓘ drops the drawing's clause
'marked "On your list"': board photos carry no such mark today — flagged on the PR for the owner.)
