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

## 2 · the three known faults — DONE and WALKED (commit "fix(maker): the RSVP card opens whole…")
- Before (`shots/2-before-*`, `sheet-2-before.png`): opens at scrollY 122, masthead cut, "CARD" tag on the guest's name;
  Question box open has only ✕. After (`shots/2-after-*`, `sheet-2-after.png`, `2-after.json`, `done.mjs` output in
  `look2-after.out`): scrollY 0 at +0.3/+1.5/+4 s at both heights, tag at 75–92 px (card top), guest name untouched at
  130; "Typing · Question" + Done at the foot (812: 768–812, 667: 623–667); Done closes the box and the draft keeps
  the words. CAUSE: `stage-tools.tsx` `centrePart` centres the form's section (`f:rsvp`) while the frame is round the
  whole card; FIX inside RSVP's files (`RSVP_TOP_MESSAGE` on a card pick and on `rsvpReady`; `RsvpPanelTypingBar`).
- Guard `lib/the-rsvp-stage-shows-the-card-and-done.test.ts`; sabotaged 4 ways red.

## 3 · the picture line — reader · look · drawing · chooser COMMITTED; browser walk RUNNING (`pic.mjs`, walk lane)
- Reader: `{ id, k: 'p', p }` kept only with a ref into an event's own scene-background folder (`lib/rsvp-picture-ref.ts`,
  import-free so the draft door does not pull the reader into the Maker's first load). Cap 200 → 240: the upload
  route can mint a 238-char ref (120-char file names) — 200 would have dropped them. Look `l: 'tall'` + Build in only.
- Look: Style › Look ▾ Wide · Tall (`RsvpPictureLookRows`, `Dd`); Tall = one rule `height:176px` in the one <style>.
- Drawing: pages sign once (`lib/rsvp-pictures.server.ts`: HEAD first, `absent` → not drawn; no picture → no request);
  `RsvpLines` draws `<img alt="">` 112 px; canvas without a file → quiet "Picture" box; Maker canvas uses the local
  object URL (`rsvp-picture-urls.ts`). Apply holds a ref outside THIS event's folder ('not_your_photo'). Allowance:
  already reads whole rows (events '*', draft_json) — now said and measured (couple-media test § 2c).
- Chooser: ＋ sheet = Heading · Message · Picture; Picture → `RsvpPictureSheet` (FileUpload media/scene-background,
  compressImage) → ONE add with the ref; Edit on a picture = Replace (one `picture` edit) + last row.
- NOT drawn in the lab after a frame reload: the lab has no R2, so the server cannot sign → the canvas shows the
  quiet "Picture" box (by design for an unsignable file). The live canvas after the add uses the local file.
- DB room test (`tests/db/rsvp-ask-config-has-room.db.test.ts`) NOT YET RE-RUN with the new fixture (heavy lane).

- WALK 1 (`pic.out`, 812): ＋ sheet = Heading · Message · Picture ✓ · chooser opens ✓ · after the upload the canvas
  shows the IMG at 279 × 112, `alt=""`, from the local file ✓ · Edit = Replace · Earlier · Later · Group · Remove ✓ ·
  Look ▾ Tall → 176 px ✓ · ↺ → 112 · ↺ → gone, draft empty ✓. FAULT FOUND: one upload made TWO picture lines
  (FileUpload emits onChange inside a state updater; React runs it twice in dev) → fixed (`handed` ref, commit
  "fix(rsvp): one upload is one picture line…"). 667 run broke on the DRIVER (＋ below is not drawn at 667) → fixed.
- RE-WALK queued/running (`pic2.out`).

## 4 · checks
- Room db test re-run with the picture look + real ref: 6/6 (`room.log`): pictures 11,219 JSON → 12,737 stored; worst
  stays the text case 17,327 → 19,025 (unchanged), ratio ×1.284, edge 17,809 → 22,905 < 24,576.
- Preflight #1 (head 50a54ab48, 36 min): 48 pass, 2 FAIL — radius lint (rounded-[14px]) and
  `the-rsvp-page-follows-the-maker.test.ts` § 7 (pinned `[currentKey]`, the fault-1 fix made it `[currentKey, truth]`)
  → both fixed in e0a5ee609. Whole-tree guards 389 files/2,775 tests PASS; DB scanners 35/249 PASS.
- Full tsc at 7168 MB ran OUT OF HEAP (rc 134); rerun at 10240 (the package's own `typecheck` setting) queued with
  preflight's quick half (`heavy2.out`).
## 5 · push / draft PR — not started (PR body drafted: `pr-body.md`; HANDOVER.md is deleted in the commit before push)
