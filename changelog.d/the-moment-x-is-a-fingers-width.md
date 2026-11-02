## 2026-09-16 · fix(story): the moment row's × is a finger's width

ST-11. Measured: `.cx` was **28px**, and **36px** under `(pointer: coarse)` —
under the 44px touch floor on desk AND phone.

⚠ THE ROW'S OWN RE-MEASURE COMMAND IS DEAD. It says to find this with
`git grep -n "moment-row" origin/main -- apps/web`. That returns NOTHING; the
class does not exist on main. A dead command is worse than none — it reads as
"already fixed". The control was found by what it DOES (the button whose
`onClick` is `onRemoveMoment`), and this PR replaces the anchor with class names
that resolve today, guarded so they cannot rot silently again.

🔑 BOTH OBVIOUS FIXES ARE ALREADY RECORDED IN THIS STYLESHEET AS FAILURES, so
neither is used:
- an invisible halo — `.x`: *"spread over a neighbour, it took off the wrong
  photo (round 3)"*;
- the app's global 44px min-height — `.x`: *"on this 26px circle that drew a tall
  oval that reached over the words and the neighbour"*.

So the BUTTON grows to 44×44 and the painted circle stays 28px (36 on touch) on
its own `.cxDot` span, with the hover background moved onto the dot. Grow the
target, not the decoration.

**Why the halo failure does not repeat here.** `.x` is absolutely positioned over
a photo canvas, so anything larger covers its neighbours. `.cx` is the last cell
of the row's grid (`auto minmax(0,1fr) auto`), so a wider cell DISPLACES its
neighbours instead of covering them. Different element, different geometry —
which is why this row and that comment are about two different ×.

SPEC IMPACT: None — same control, same appearance, larger hit area.
