// Account auto-surface (#7b) — server-side kill switch. DEFAULT OFF.
//
// The feature auto-attaches an event to a guest's already-claimed Setnayan account
// (inclusion-by-default: "sent whether they accept or not; only NO removes it").
// That inclusion-by-default is the RA 10173-sensitive part, so it stays gated
// behind this flag and BLOCKED on external PH counsel. Flip to '1' only after
// counsel signs off the lawful-basis + notice. Server-only (no NEXT_PUBLIC).
export function accountAutosurfaceEnabled(): boolean {
  return process.env.FEATURE_ACCOUNT_AUTOSURFACE === '1';
}
