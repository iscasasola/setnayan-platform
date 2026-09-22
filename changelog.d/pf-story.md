## 2026-09-22 · fix(a11y): the website photo-moments controls meet the 44px touch floor

W5. ⚠ **NOT register ST-11 — see the correction at the end.**

The website photo-moments editor's remove control — and its two reorder siblings — were `p-1.5`
around an `h-4 w-4` icon: **16px of icon plus 12px of padding = a 28×28 target**,
on a row a host edits on a phone. WCAG 2.5.5 and the Apple HIG both put the floor
at 44px.

🔑 **It was invisible to every other check.** It renders correctly, it is
keyboard-reachable, it has an `aria-label`, contrast passes. The only symptom is
a person on a phone tapping three times and deleting the wrong moment. A control
being *drawn* small is not the defect; being *hittable* only when small is.

Fixed with `inline-flex min-h-11 min-w-11 items-center justify-center` — the icon
keeps its drawn size, only the hit area grows.

**A baseline, not a sweep.** 20 more controls in 15 files share the shape. Fixing
all twenty here would put twenty unreviewed visual changes into a bundle about
something else, and some sit in dense admin tables where 44px genuinely may not
fit and the answer is a different layout. So the three in this editor are fixed, the
rest are frozen at their current counts, and the number can only go down. Same
contract as the unread-error baseline: **debt, not permission.**

The second test pins the destructive control specifically. A fix that widened
the two reorder arrows and left the destructive one small would pass a bare
count, so it checks the Remove button specifically.

⚠ Scope, stated: this matches `p-1`/`p-1.5` on a `<button>` with no `min-h`
floor. It is a shape check, not a computed-layout check — a control sized by a
parent, by CSS or by a wrapper component is invisible to it.

🪤 The second assertion FAILED against correct code on first write: it sliced
from `<button` to the `aria-label`, and in this JSX `className` comes AFTER the
label, so the window excluded the very attribute under test. Widened to span the
whole opening tag, with a note saying why.

Proved by sabotage: shrinking the REMOVE control back while leaving its siblings
floored turned both tests red; adding a new undersized button elsewhere turned
the ratchet red (`16 file(s), 21 control(s)` vs a 15-file baseline). Restored, 2/2.

SPEC IMPACT: None.

### ⚠ CORRECTION — this is not ST-11, and how that was caught

I found these controls by grepping a guessed symbol. **ST-11's own re-measure
command is `git grep -n "moment-row"`, and running it shows the row is ALREADY
FIXED on main** — by `lib/the-moment-x-is-a-fingers-width.test.ts`, which covers
`app/dashboard/[eventId]/story/_components/make-it-yours.module.css`: a
`rounded-full` 26px `×` that was 28px on desk and 36px on coarse pointer.

🔑 **RULE 0 says run the row's re-measure BEFORE building, and I did not.** I
searched by a symbol I invented, landed on a different file, and only found the
real subject afterwards. The fix here is still real — three 28×28 controls in the
website photo-moments editor genuinely were under the floor, and nothing else
covered them — but it closes no register row, and it is recorded as its own work
rather than credited to one.

⚠ That existing guard also records TWO fixes tried and REJECTED on its control:
an invisible halo ("spread over a neighbour, it took off the wrong photo") and
the app's global 44px min-height ("on this 26px circle that drew a tall oval that
reached over the words and the neighbour"). Neither applies here — those controls
are `rounded-md` squares, both `min-h-11` AND `min-w-11` are set so they grow
square rather than oval, and they sit in a `flex … gap-1` row where spacing is
handled by the container, not by insets.

⚠ **Unverified in a browser.** The control cluster grows from ~92px to ~140px
wide and the header row gains height. That is the intended effect of a touch
floor, and the geometry is sound, but it has not been looked at on a real screen.
