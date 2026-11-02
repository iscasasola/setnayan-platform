## 2026-07-21 · fix(checkout): bottom sheets use `dvh` so the submit button is reachable on mobile

Owner report (Multicam control room · ₱2,800 checkout): "cannot complete
transaction, bottom part not viewable."

Cause: the bottom sheets were capped at `max-h-[90vh]` inside a `fixed inset-0`
overlay. On iOS Safari / Chrome Android `vh` resolves to the **large** viewport
(URL bar hidden), so a bottom-anchored 90vh sheet extends underneath the browser
toolbar — the last rows of the checkout form (payment-screenshot dropzone +
"Submit request") sit below the visible area and cannot be scrolled into view.

Fix — three sheets that shared the same class string:

- `app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx` — the
  reported one. `h-[100dvh]` on the overlay, `max-h-[90dvh]` on the sheet,
  `overflow-hidden` so the rounded top clips, and a
  `pb-[max(1rem,env(safe-area-inset-bottom))]` scroll body so the submit button
  clears the iOS home indicator.
- `app/_components/sheet.tsx` — same overlay/sheet fix.
- `app/_components/app-store/choose-plan-sheet.tsx` — same, plus safe-area pad
  on the plan list (it hosts the checkout drawer).

Desktop (`sm:`) geometry is untouched — still a right-side drawer at `h-full`.

SPEC IMPACT: None — presentation-layer fix, no SKU / pricing / flow change.
