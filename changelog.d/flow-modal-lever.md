## 2026-06-20 · feat(ui): shared useEscapeKey hook — modal lever foundation (flow wave E)

The user-flow audit found many overlays missing Escape-to-dismiss (a keyboard/accessibility dead-end) or hand-rolling the same keydown listener inline (~22 modal findings). This adds the single shared hook every modal/sheet/popover should use.

- **`apps/web/lib/use-escape-key.ts`** (new) — `useEscapeKey(onEscape, active=true)`. One overlay = one call; pass `active=false` to suspend mid-submit.
- **Converted exemplar:** `app/dashboard/[eventId]/_components/ceremony-type-modal.tsx` (audit HIGH: "missing Escape key dismiss") now calls `useEscapeKey(onClose, !pending)` — Escape closes it, suspended while a save is pending (matching the existing click-outside + close-button `!pending` guard).

Foundation + exemplar; the per-modal sweep (other ad-hoc overlays) follows incrementally, and a `useFocusTrap` companion is a separate follow-up (the remaining modal-lever findings).

Verified: hook created; ceremony modal imports + calls it; both files pre-flighted clear of open PRs. tsc/lint/build via CI.

SPEC IMPACT: design-system/UX only. Flow wave E. Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.
