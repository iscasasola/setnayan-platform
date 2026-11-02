## 2026-06-25 · feat(a11y): focus-trap modal sweep — final batch (multi-overlay + special cases)

Closing batch of the app-wide modal focus-management sweep (#2134 `useModalA11y`,
#2139 Sheet, #2140–#2143 overlays). Wires `useModalA11y` into the remaining
genuine modal overlays — 13 across 7 files, including multi-overlay files that
needed one ref+hook per overlay:

- `_components/account-switcher/account-switcher.tsx` (2 dialogs)
- `_components/guided-tour.tsx` (centered tour card)
- `dashboard/[eventId]/_components/event-switcher.tsx` (edit-monogram confirm only; the role="menu" surfaces keep their own keyboard model)
- `dashboard/[eventId]/_components/vendor-availability-intersection.tsx` (2 modals)
- `dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx` (filter/sort/assign sheets)
- `dashboard/[eventId]/vendors/_components/accordion-lock.tsx` (exception + slot-picker modals)
- `site-editor/[eventId]/_components/site-editor.tsx` (hero + backdrop edit sheets)

### Deliberately NOT migrated (documented so the sweep is auditable)
- **`confirm-dialog.tsx`** — native `<dialog>`/`showModal()`; the browser already
  traps focus, handles Esc, and restores focus.
- **`plan-card-compare.tsx`** — its real modal is a native `<dialog>` (already
  accessible); the three `role="dialog"` blocks (SlotPicker/Conflict/SoftHoldLimit)
  are **inline panels** misusing the role (no `fixed`/backdrop), so trapping focus
  + locking scroll on them would be a bug. (The role misuse is pre-existing; left
  for a separate cleanup.)
- **`vendor-direct-pay.tsx` (ModalShell)** and **`category-search-overlay.tsx`** —
  **nested / layered** modals (a confirm rendered ABOVE an open `<Sheet>`; a filter
  sheet whose Esc must close before the parent overlay). The flat hook has no modal
  stack, so a second trap + a flat Esc-to-close would fight the parent. Needs a
  `useModalA11y` nesting enhancement (topmost-only) — tracked as follow-up.
- **`shortlist-categories.tsx`** — its `role="dialog"` is a transient loading shell
  that swaps to the shared `RequirementsModal` (already migrated in batch 1).
- **`onboarding-shell.tsx`** — a CSS-class-toggled BYO-vendor sheet inside a
  4,600-line actively-developed onboarding file; low value, high churn-conflict
  risk. Deferred.

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
