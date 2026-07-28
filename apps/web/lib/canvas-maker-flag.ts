/**
 * ZERO-STEP SERVICE CARD MAKER ("the card IS the form") — feature flag.
 *
 * Gates which component `/vendor-dashboard/services/new/[category]` renders:
 * ON  → <CanvasMaker>, the stepless canvas (owner-locked 2026-07-27, "THE MAKER
 *       IS ZERO STEPS — THE CARD IS THE FORM"; artifact 15007a4d).
 * OFF → <ServiceWizard>, the shipped 6-step wizard, untouched.
 *
 * The canvas is an alternative RENDERING of the wizard's one
 * `<form action={commitVendorService}>` — same action, same input names, same
 * child editors. Nothing on the server knows which one drew the screen, which
 * is why flipping this flag can never change what gets saved. The guarantee is
 * mechanised by lib/canvas-field-parity.test.ts.
 *
 * NEXT_PUBLIC_ because the page (a server component) reads it to choose the
 * component AND to skip the canvas-only audience lookups entirely when it is
 * off — so flag-OFF costs not one extra query. Only the exact truthy strings
 * enable it; anything else (including a missing var) is OFF, so the maker ships
 * dark and the owner flips it on.
 */
export function canvasMakerEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_CANVAS_MAKER_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
