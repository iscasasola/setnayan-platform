## 2026-06-25 · feat(a11y): nested-modal support in useModalA11y + migrate the 2 layered overlays

Enhancement closing the two cases the flat focus-trap couldn't safely cover in
the modal sweep (#2134/#2139/#2140-2143/#2146).

**`apps/web/lib/use-modal-a11y.ts`** — added a module-level **modal stack** so
only the TOPMOST open modal traps Tab and closes on Escape; nested-under modals
stand down until they're topmost. Escape now peels one layer at a time and Tab
stays in the frontmost layer. Body-scroll-lock is now **reference-counted**, so
an inner modal closing doesn't unlock the page while an outer modal is still
open. Escape handling moved into the stack-aware keydown handler (gated on
topmost) via an `onClose` ref, so it no longer needs `useEscapeKey` and inline
`onClose` handlers don't re-run the effect. **Backward-compatible**: a lone
modal is always topmost, so all ~38 already-migrated modals behave identically.

Migrated the two previously-deferred layered overlays onto the enhanced hook:
- **`vendor-direct-pay.tsx` (ModalShell)** — the QR/link confirm renders at
  z-[60] ABOVE the open `<Sheet>` (z-50); now the confirm is the topmost trap
  and the Sheet resumes when it closes, with the page staying scroll-locked
  underneath.
- **`category-search-overlay.tsx`** — main overlay + nested filter sheet; the
  hand-rolled layered-Escape + scroll-lock effect is replaced by two
  `useModalA11y` calls. Escape closes the filter sheet first, then the overlay —
  same layering, now from the shared stack.

Verification: relies on required CI; nesting behavior best spot-checked in the
Vercel preview (open a vendor's pay Sheet → a QR/link method → Esc closes the
confirm first; open category search → Filter → Esc closes the filter first).

SPEC IMPACT: None — a11y infrastructure, no schema/SKU/pricing/flow change.
