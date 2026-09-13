## 2026-09-02 · fix(live-studio): free path leads the doorway, not the ₱3,000 buy button

`apps/web/app/dashboard/[eventId]/studio/live-studio-control/page.tsx` — for a host who has not
bought Live Studio, "Open the controller — go live free with one camera" was a plain text link
rendered below the filled ₱3,000 "Add Live Studio" button. Wave 3 (owner-locked 2026-07-25 § 4d)
says the free rehearsal room IS the conversion mechanism, so the doorway was at odds with the
lock it implements.

Delta only: the free-controller link now renders first, styled as an outline pill button at the
same size/weight as the buy CTA. Price, SKU wiring, and the buy drawer are untouched. For an
owner who already owns Live Studio, the CTA was already a single "Open controller" button with no
buy button shown — confirmed unchanged.

SPEC IMPACT: None — this restores emphasis to match the existing Wave 3 lock; it doesn't change
what either path does.
