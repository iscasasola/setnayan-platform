## 2026-08-17 · fix(save-the-date): the veil can fail to draw, but it must never make the page untouchable

🔴 **A GUEST COULD BE PERMANENTLY LOCKED OUT OF A SAVE-THE-DATE, AND ONE OF THE
TWO WAYS IN IS AN ACCESSIBILITY SETTING.**

The veil mounts a screen-wide hit-zone so a guest can swipe it off. It rendered
`pointerEvents:'auto'` from first paint, and the ONLY code that ever shrank it to
the top valance band lives inside the requestAnimationFrame loop. **Two guards
return from the mount effect before that loop is ever scheduled:**

- **`prefers-reduced-motion: reduce`** — an ordinary iOS/macOS accessibility
  setting, and by far the more common path
- **the WebGL constructor `catch`** — whose own comment reads *"No WebGL → reveal
  silently (never gate the guest)"*, and which did precisely the opposite

On either path the guest got an invisible full-screen sheet with nothing left
running to remove it — and the parent **deliberately never unmounts the veil**
("reveal stays on top, not under", owner 2026-06-18), so it never went away.
Every tap, swipe and scroll landed on nothing until they closed the tab.

**The fix inverts the default.** The hit-zone now renders `pointerEvents:'none'`
and is armed on the loop's first frame (~16ms), past every early return. Any path
that never reaches the loop now leaves the page fully usable instead of fully
dead.

🔑 **THE SHAPE IS "BLOCK FIRST, RELEASE LATER."** Anything that starts by blocking
input and relies on later code to release it is one early `return` away from
trapping somebody — and here the two early returns were the paths taken by the
guests least able to work around it.

🔬 **Found by an adversarial sweep, but the sweep only found the WebGL half; the
reduced-motion path — the common one — came from checking its claim by hand.**
An agent's finding is a lead, not a result.

🛡 3 assertions, mutation-checked. ⚠ The FIRST mutation run was worthless twice
over and the counts are what showed it: one `perl` substitution died on the JSX
braces and printed "landed" while changing nothing, and the next replaced the
first of TWO identical-looking lines — the mount host, not the grab-zone — so the
sabotage landed on the wrong element and the guard stayed green for a correct
reason. Retargeted inside the `ref={grabRef}` block: 2→1 on the right element,
suite RED; arming line removed, suite RED; restored, 3 pass.

⚠ Source-level assertions on purpose: the veil needs WebGL, a canvas and a live
rAF loop, and this repo has no harness that can drive it. Stated so nobody reads
more into them.

SPEC IMPACT: None — restores the documented intent ("never gate the guest").
