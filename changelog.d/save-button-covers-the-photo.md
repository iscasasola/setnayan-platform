## 2026-08-10 · fix(papic): the Save control sat on top of the photo it saves

Found by the owner looking at his own gallery: fourteen photos on screen, every
tile with a dark 44px pill reading **"Save"** parked over its upper-left. He
could not see any of his pictures. The control built to save a photo was hiding
it. It ships on two surfaces — the couple's Papic gallery and the guest day-of
wall — so every tile in both was affected.

**⚠ The obvious fix was the wrong one.** Shrinking the control, or dropping the
word, would break the **Guest Legibility Floor** recorded in the component: the
save action must be a VISIBLE, ≥44px-tappable, LABELLED control, not a 20px
icon-only corner dot an older guest cannot see or hit. That decision predates the
bug and did not cause it.

🔑 **The bug was the POSITION, not the size.** Anchored to an edge with its own
scrim, a 44px labelled bar reads as chrome; dropped at `left-1.5 top-1.5` on a
thumbnail it reads as an object sitting on the subject. It is now a bottom bar
over a gradient scrim — photos are framed centre and upper-middle, so the bottom
strip is the one place a control costs nothing. Label, accessible name, 44px
target and press state all unchanged. The tile's tag/story dots already render
after it in the DOM, so they still paint on top and stay legible.

Guarded both halves, because the next person to see the overlap will reach for
the size. Mutation-tested four ways, baseline green, every sabotage verified
applied: restore the floating pill (caught) · shrink below 44px (caught) · drop
the word for icon-only (caught) · delete the scrim (caught). ⚠ The scrim
assertion needed tightening first — `bg-black/` also matched the button's own
`active:bg-black/70`, so the deleted-scrim sabotage passed until it required the
gradient itself.

SPEC IMPACT: None — the legibility floor is unchanged and explicitly re-pinned.
