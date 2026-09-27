## 2026-09-27 · feat(maker): font dropdown, one letter in its own face, and In · During · Out per element

Two owner rulings on #6019's element sheet, 2026-09-27:

- *"font should be a drop down. and they can interchange whichever text they highlight to be on that
  font. they can take 1 letter and change the font."*
- *"each element can have a transition and animation. Transition in and out. Animation During. we
  already discussed this."* This is the 2026-09-23 hero-canvas editor model.

**Font is a dropdown.** Each font is drawn in its own face, with "Event Hub font" at the top as the
reset. The fonts come from the same closed `HUB_FONTS` set.

**Selection styling (runs).** In the Maker canvas the couple selects part of a hero part's text: a
word, or one letter.
- The bridge (`selectionInPart`) posts the selection as start/end offsets into that part's text,
  plus a hash of the text (`hubTextHash`).
- Font, colour and size then apply to just that range. "Whole names" goes back to styling the
  whole part.
- Runs are stored on the element in `canvas.elements` (`runs`, `of`).
- The guest page renders them as spans server-side (`hubTextSegments` in `PahinaMasthead`), so guests
  see exactly what the canvas showed.
- If the text changes, its runs are dropped, never moved onto other letters.

Runs are for the **hero's parts** only (eyebrow, names, the invitation line, date, time). A scene's
words are drawn by widgets that must stay canvas-ignorant, so a run there could not reach a guest.

**Motion per element.** This replaces #6019's single "Animation" row:
- **Plays once / Follows the scroll** sits above the three choices.
- **In** is Rise, Fade or None. **During** is Drift or Still; Ken Burns and Parallax are for photos,
  and no element here is a photo.
- **Out** is Fade away, Lift away, Settle back or Stay put. It exists only when the element follows
  the scroll.
- **Duration and Delay** apply only when the element plays once; they dim when it follows the scroll.
- **In and During run together** as comma-separated animations. Drift moves `translate`, so it
  composes with an In's `transform`.
- **Play** replays the In with the editing outline hidden, by swapping to a `-p` twin keyframe.
- #6019's old values carry over: Calm → Fade in; Editorial → Rise in; Cinematic → Rise in + Drift,
  following the scroll.

**Checks.** Every value is a closed-set key and is sanitized. The Pro gate compares font, colour,
size, motion and runs each on its own, so adding is Pro and taking off is free. +0 server actions.

SPEC IMPACT: None. This implements DECISION_LOG 2026-09-27 ("FONT IS A DROPDOWN…") and the
2026-09-23 element motion model as recorded.
