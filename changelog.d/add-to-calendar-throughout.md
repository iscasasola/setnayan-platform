## 2026-08-24 · fix(guest): "Add to calendar" is there the whole time, not only at the end

**H-5 (W3-D).** Measured on two live invitations 2026-08-24: an anonymous fetch
of `/cale-ice` and `/maria-and-jose` each contained "Add to calendar" **exactly
once**, at the film's terminal beat. A guest who lifted the veil, read the date
and left had no way to put it in their phone short of watching the whole film to
its end.

A quiet chip now sits above the film's bottom chrome for the whole run, and the
closing beat keeps its full accent button as the finale.

**This is the second time this exact shape has been fixed in this file** — the
"See our page" way-out had the identical defect from the identical cause (a real
control parked on the LAST beat), and the owner hit it on his own phone on
2026-08-04. This copies that repair rather than inventing a second pattern:
`started` as the mount condition, the same quiet chrome weight.

`started` is load-bearing and is not a style. Every beat of the film is mounted
from frame one behind `pointer-events-none` + `aria-hidden`, and neither removes
an element from the tab order — so a control merely rendered in the persistent
chrome would be Tab-reachable under the veil, two keystrokes past everything the
couple paid for.

The transient "press and hold to pause" cue moves from `bottom-16` to
`bottom-28` so a fading hint never sits on top of a control that stays.

8 mutations, all measured by occurrence count; 7 red. The 8th exposed one of my
own assertions as decoration — it counted only left/right-anchored controls, so
it could not see the centred third chip it claimed to prevent. Widened, then
re-mutated: 2 → 3, red.

SPEC IMPACT: None — no locked decision, price, SKU or schema. The cinematic
opening and the closing beat's finale button are untouched.
