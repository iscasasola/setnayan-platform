## 2026-06-25 · feat(a11y): shared useModalA11y focus-trap primitive

Follow-up to the checkout UX audit (PR #2133). Our overlays render correct
`role="dialog"` semantics but did NOT manage focus: opening a modal left focus
on the trigger behind the backdrop, Tab could wander into the page underneath,
and focus wasn't restored on close — a keyboard/SR dead-end on every modal.

- **New `apps/web/lib/use-modal-a11y.ts`** — one shared hook (sibling to
  `useEscapeKey`, which it composes) that on open remembers focus, moves focus
  into the dialog, traps Tab/Shift+Tab inside it, locks body scroll, and on
  close restores focus to the trigger. Generic over the container element type
  so a `useRef<HTMLDivElement>(null)` assigns cleanly under React 19's
  invariant `RefObject.current`.
- **`inline-checkout-drawer.tsx`** — replaced its hand-rolled Esc + scroll-lock
  effect (no focus handling) with `useModalA11y`; the drawer is now a fully
  trapped dialog. Its own comment ("keyboard focus returns here on close") is
  now actually true.
- **`self-purchase-confirm.tsx`** — the self-purchase modal had no Esc, no
  focus management, and no scroll lock at all; now wired to `useModalA11y`.

Adoptable by every other overlay in the app (ChoosePlanSheet, sheets, etc.) as
a one-line call — future PRs can migrate them off bespoke/missing focus code.

Verification: type-safe + relies on required CI (typecheck/lint/build). Focus-
trap *behavior* is best spot-checked in the PR's Vercel preview (open a modal,
Tab through, confirm focus cycles inside and returns to the trigger on close).

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
