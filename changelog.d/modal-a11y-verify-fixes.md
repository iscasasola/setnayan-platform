## 2026-06-25 · fix(a11y): resolve adversarial-verification findings on the modal focus-trap

A 95-agent adversarial review of the modal-a11y sweep (verdict: has-blockers)
surfaced real keyboard-behavior defects that typecheck/build/e2e can't catch.
Fixed in `useModalA11y` + two consumer files before the hook change is trusted
in prod:

- **HIGH (hook)** — the default container-focused open state leaked focus
  backward out of the dialog on the first Shift+Tab (the container is
  `tabindex=-1`, so `active===container` matched no edge guard). Now any element
  not in the focusable set (incl. the container) is treated as an edge, so the
  first Tab/Shift+Tab wraps inward. Affected every modal using the default
  focus config.
- **HIGH (hook)** — a non-LIFO close (a parent closing while a child is still
  open) yanked focus out of the still-frontmost child. Focus is now restored
  only when the closing modal was the topmost (`wasTopmost`).
- **HIGH (`requirements-modal.tsx`)** — `containerRef` was on the inner panel
  while `role="dialog"` was on the outer overlay, leaving the backdrop Close
  button outside the trap (keyboard-unreachable). Ref moved to the overlay.
- **MED (`filter-drawer.tsx`)** — same root cause; `role`/`aria-modal`/
  `aria-label` moved onto the trapped+focused panel so a screen reader announces
  the dialog on entry.
- **MED (hook)** — focus restore now guards `isConnected` and falls back to the
  `main` landmark instead of stranding focus on `<body>` when the trigger is gone.
- **MED (hook)** — the topmost modal now `preventDefault()` +
  `stopPropagation()` on Escape so one keystroke peels exactly one layer (no
  global/parent double-act).
- **LOW (`shortlist-categories.tsx`)** — the transient loading shell was
  `aria-modal` with no focus management; demoted to a `role="status"` busy
  indicator (it hands off to RequirementsModal, which owns the real dialog a11y).

Backward-compatible: a lone modal is always topmost, so the ~35 already-migrated
modals keep identical behavior, now with the leaks closed.

SPEC IMPACT: None — a11y correctness, no schema/SKU/pricing/flow change.
