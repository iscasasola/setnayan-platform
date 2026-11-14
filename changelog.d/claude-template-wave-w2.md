## 2026-11-14 · style(couple): template wave W2 — monogram, story desk, invitation sheets and the stage picker follow the design template

Template wave W2: the free files of `monogram`, `story`, `invitation` and `launch`. Files open PRs hold are left to
them (#7605 · #7610 · #7545 · #7684). Style only: same words, same data, same actions, shared pieces only.

- **Monogram:** the mark-everywhere popup, upload, draft restore, studio, ink compare and tips.
  - No tiles; notices are one coloured line.
  - Restore is the warm-surface next step.
  - Done and Make it my monogram are the main pill.
  - Captions are grey capitals.
- **Story:**
  - The desk's Accept / Edit / Reject / Save the words are the shared pills (green, grey, red, terracotta), with a grey
    "waiting" pill instead of a spinner.
  - The outcome is the shared `Badge`.
  - Items are hairline rows; a held item gets the gold edge.
  - The rail's counters and progress, and the whats-next and theme steps, are unboxed with grey-capital captions.
- **Invitation:** "Send to {guest}" and "Replace {guest}'s QR?" are the house `Sheet` instead of hand-drawn overlays.
  - Replace QR is red and Cancel grey, equal widths.
  - Warnings are amber or red lines.
  - Both leave `drawn-in-place.baseline.txt`.
- **Launch:** the stage picker's three presses are the shared pills; its head caption is grey capitals.
- **Type:** no words under 12 px, no ink under 70 %.
- **Baselines recorded, not weakened:**
  - `label-contrast-dark.baseline.json` drops the 5 dark pairs this PR fixed;
  - `port-control-baseline.json` is regenerated. The invitation route deliberately no longer draws `OverlayBackdrop` —
    the sheet replaced it. `main`'s copy was behind, so the diff also carries other merges' additions.
- **Kept on purpose:**
  - the illustration colours in the monogram scenes and the camera face;
  - the Maker logo's drawing art;
  - the Maker desk's own stylesheet;
  - `make-it-yours` (its own CSS-module studio).

SPEC IMPACT: None — implements the approved design template (Setnayan-specs `prototypes/design_template_sheet_2026-11-14_fable.html`); no decision changed.

**Ratchet (14 Nov, after #7704 landed):** `lib/template-score.baseline.json` is lowered for W2's four pages only.
