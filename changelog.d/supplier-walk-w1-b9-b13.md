## 2026-11-16 · fix(supplier): walk W1-B10 → B13 — one "N of 6", one state per paper, a person past the tries

- **W1-B9** — dropped from this batch: confirmed FIXED on live (walkthrough 2, 16 Nov 2026); no change here.
- **W1-B10 · ONE checklist, ONE count.** Today's "Get your shop live" six and Your details' "N of 6" counted two
  different sixes. Both now draw `shopSetupView` (`lib/supplier-setup.ts`): Your details' headline ("2 of 6 done ·
  left: Send your documents · Download your QR"), its bar and its strip's "steps done" are Today's six. A verified shop
  (no rail — Today counts nothing) shows no count; an unread rail says so. "Send your documents" now ticks by the paper
  rows' rule (all papers in), still naming "Send them", and "All done" no longer claims Setnayan is checking papers nobody
  sent. Held by `lib/one-checklist-one-count.test.ts`.
- **W1-B11 · the strip fits at 375 px.** The pinned row's fit pass (`pin-doors.tsx`) gains a step before it slides:
  each door's SHORT word (the folded line's) under `[data-short]`. Held by
  `app/_components/pinned-row/the-strip-shortens-before-it-slides.test.ts`.
- **W1-B12 · one paper, one state.** `paperState` (`lib/paper-intake-shared.ts`) derives each paper's status, refusal
  reason, send-back reason and try count once, from the stored slot plus the last upload's word on THAT paper; the rows
  and "N of 3" draw it, and the list draws only files that named no paper. A file filed with no read reads "a person
  checks it", never "Waiting for a photo". Held by `lib/one-paper-one-state.test.ts`;
  `a-send-back-names-only-its-paper.test.ts` anchor retargeted.
- **W1-B13 · owner ruling 17.** Past the third refused copy a paper goes to a person (the existing admin queue's
  `manual` "typed after three tries" paper) — the refusal that filed nothing ("You've used your three tries") is gone;
  typing what the paper says is optional. No schema change.

SPEC IMPACT: Your details' "N of 6" is now Today's six (prototype moment 6 drew a details-only six) — flagged to the owner
for sign-off; ruling 17 is applied in code only (no corpus edit from this session).
