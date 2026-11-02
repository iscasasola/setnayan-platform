## 2026-08-21 · fix(event-hub): the share pill stops covering the date and the sign-up button

Measured on the live invitation at 375px (2026-08-21): the floating Share ·
Report pill sat over **85% of the "Sign up free" button** — `elementsFromPoint`
at that button's centre returned **Share** — and over three-quarters of the
**wedding date** on the hero. Two of the most consequential things on the page:
the tap that creates an account, and the single fact an invitation exists to
convey.

🪤 **THE PREVIOUS FIX MOVED THE COLLISION RATHER THAN ENDING IT.** The
component's own docblock records the pill being lifted clear of the bottom menu
BAR, because it was being drawn underneath it and "tapping Share hit whichever
tab happened to be there". That was correct — and it landed the pill squarely on
the **content** instead. **Anything `fixed` needs its footprint reserved in the
flow; lifting it only chooses a different victim.**

The fix is the pattern `site-menu-bar.tsx` already uses for its own bar: an
in-flow, `aria-hidden` spacer the height of what floats above it. 3.5rem clears
the pill in both of its positions — stacked on the menu bar's own 3.5rem spacer
when a menu is present, standing alone when it is not.

Guard added to `bottom-edge.test.ts`, the file whose whole subject is which
component owns the bottom strip. It asserts the reservation, not the position,
and that the spacer is a SIBLING IN THE FLOW rather than inside the fixed
wrapper (where it would reserve nothing). 3 sabotages, all landed by occurrence
count, all RED.

🪤 My first "verification" of this change was a tool that never ran: the fresh
worktree had no dependencies, so `typecheck` reported success while `next` was
not even on the path. Re-run after installing.

9175 unit tests · typecheck · lint · `lint-no-stacked-pinned-bars` ·
`lint-port-no-lost-controls` all green.

SPEC IMPACT: None.
