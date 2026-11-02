## 2026-09-05 · fix(guests): a 44px tap target is not a 44px ring

Two defects found by OPENING THE PAGE on a phone viewport, after three merged
PRs of green tests said the guest-row work was finished.

**1 · The dashed "+" was an ellipse.** `globals.css` gives every `button`
`min-height: 44px` — the ≥44pt touch target from the kickoff rules, and
correct. `AddToGroupControl` put `h-6 w-6 rounded-full border border-dashed` on
the **button**, so the height lost to that rule and the "circle" rendered
**24 × 44**. Measured live with `getBoundingClientRect`, not inferred. It had
been that way on the desktop row since the control shipped: a tall control just
absorbs into a tall row. It became obvious only once the same control landed on
the compact list row, where the chips beside it are 20px tall. The ring now
lives on an inner 24×24 span; the button keeps the full 44px hit area — a shape
bug is never fixed by shrinking a touch target.

**2 · A panel that contradicted its own trigger.** `LockedChip` (shipped hours
earlier the same day) advertises `aria-haspopup="dialog"` because nothing in it
is choosable — then rendered through `Popover`, which hardcoded `role="menu"`.
A menu with zero `menuitem`s, promised by a trigger saying dialog. Its own test
asserted the trigger's `aria-haspopup` and passed, because it never looked at
what actually opened. `Popover` now takes `role?: 'menu' | 'dialog'`, defaulting
to `menu` so every existing picker is unchanged.

Guarded by
`apps/web/app/dashboard/[eventId]/guests/_components/a-44px-tap-target-is-not-a-44px-ring.test.ts`
(5 tests; three mutations measured RED; route-scoped `tsc` exit 0; suite 50/50).

⚠ The FIRST DRAFT of that test did not catch defect 1. Its button-tag regex
`/<button[\s\S]*?>/` stops at the `>` inside `onClick={() =>`, so it never
reached the className and the mutation scored **0 failing**. It now scans for a
`>` not preceded by `=`, and a test guards that extractor. The green mutation
run is the only reason it was caught — asserting on an extract nobody checked is
defect 2 one level down.

SPEC IMPACT: None.
