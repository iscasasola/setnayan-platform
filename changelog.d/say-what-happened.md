## 2026-08-05 · fix(guest-site): a guest is told what happened to them

**SPEC IMPACT:** None.

**1 · A reply could silently not be saved.** `submitRsvp` handled a failed write
with a bare `return`, under the comment *"Best-effort silent failure for
guest-side surface… A toast UI lands with the polish pass."* The polish pass
never came. The guest tapped Save, the button stopped spinning, the page came
back looking exactly as before, and nothing was written.

This is the one failure with **no natural discovery path**: the guest has no
reason to check again — they replied — and the couple cannot tell *"never
answered"* from *"answered and we dropped it."* The caterer's headcount is short
and nobody learns why until the day.

Worse than reported: the **success** path was silent too. It redirected with
`?saved=1` and nothing anywhere rendered that param, so both outcomes produced
the same page. Fixing only the error half would have left "no message" still
meaning two different things. Both now say so, at the TOP of the form (at the
bottom it is below the fold on a phone, and the whole point is that the guest
must not walk away thinking they replied), with `role="alert"` on the failure.

**2 · A padlocked tab could not explain itself on a phone.** `site-menu-bar.tsx`
states in its own comment that *"a padlock with its reason says the truth"* — and
put the reason in a `title=`, a native tooltip that requires **a mouse
hovering**. This is a fixed bar at the bottom of a phone screen. There is no
hover. Every guest saw a faint Camera with a small padlock and had no way at all
to learn why. The resolver has always carried `lockedReason` precisely so it
could be said out loud; the bar just never said it. Tapping now reveals it, and
the reason is in the `aria-label` so a screen reader gets it without tapping.

Both locked renderers are covered — the camera keeps its own copy of that markup
and is the slot most often locked. `say-what-happened.test.ts`, all
mutation-verified.
