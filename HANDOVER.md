# HANDOVER — rd/rsvp-picture-line (worktree `wt-rsvp-picture`, base origin/main d2e38b7c1)

Local commits only until step 5 says otherwise. This file is a working note: it is DELETED in the commit before the
push (it must never reach main). Scripts and pictures: `~/Documents/Claude/Projects/controller-2026-10-12/rsvp-pic/`
(`shoot.sh <script>` = own dev server on 3507 under the heavy lock, stopped after; `tsc.sh`; `sheet.py`).

## Decisions now made (DECISION_LOG 2026-10-12, corpus d93cacd) — the picture line's a–d
(a) upload via the shipped scene upload (`FileUpload bucket="media"`, `compressImage`, `events/<id>/scene-background`);
`couple-media-allowance` counts a ref held in `rsvp_ask_config` · (b) FREE · (c) decorative, `alt=""`, no field ·
(d) a missing file draws nothing for that line.

## 1 · the undo fault — DONE (commit "fix(maker): an Undo reaches the RSVP stage's canvas")
- Walked (lab, 375 × 812, touch) — `walk1.out`, `shots/1-*.png`, contact sheet `shots/sheet-1-AB.png`:
  A as fixed: ＋ Message typed → ↺ (words gone) → ↺ (line gone) ✓ · one-step ＋ Heading → ↺ gone ✓ · new edit after
  does not resurrect it ✓ · Invitation and back ✓. B remedy off: the line stays after ↺ ↺ and the undone Heading is
  written back by the next edit ✗ (the "before"). C lab as it was: same as B ✗.
- Sabotage of `lib/rsvp-stage-truth.test.ts`: pending no longer defers · unheld owes nothing · frames not told ·
  panel not re-seeded → each red; restored → 5/5.
- A Next dev "Hydration failed" pageerror shows in all three passes of the lab (also C) — the lab page, not this fix.
- STORE HOLE, NOT FIXED (outside RSVP's files): `lib/maker-draft-store.ts` `read` answers OUR copy when the server is
  back at the value ours was built on. Proven on the pure core (`probe/store-base.test.ts` in the scripts folder).
  Every scene panel reading `draftedCanvasOr` / `draftedOwnWordsOr` (part-look, part-words, scene-background-row,
  scene-style-row, element-sheet, type-in-place, use-scene-canvas, love-story-live, studio-dos) is exposed when the
  ONLY step of a visit on that scene is undone: the next pick there is built on the undone copy and writes it back.

## 2 · the three known faults — see below as they progress
## 3 · the picture line — not started
## 4 · checks — not started
## 5 · push / draft PR — not started
