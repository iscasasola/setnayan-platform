## 2026-06-25 · feat(a11y): focus-trap the shared Sheet primitive

Part of the app-wide modal focus-management sweep (follow-up to #2134's
`useModalA11y`). `Sheet` (`apps/web/app/_components/sheet.tsx`) is the reusable
bottom-sheet/drawer primitive; its JSDoc claimed a "focus trap" but it only
hand-rolled Esc + scroll-lock and explicitly left initial focus to the
consumer. Wired it to `useModalA11y`, so **every `<Sheet>` consumer** now gets
focus-in + Tab trap + focus-restore for free, and the doc is now accurate.

Net: replaced the bespoke Esc/scroll-lock `useEffect` with one
`useModalA11y({ open, onClose, containerRef })` call + a ref on the dialog
element. `confirm-dialog.tsx` was intentionally left alone — it's built on the
native `<dialog>`/`showModal()` element, which already traps focus natively.

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
