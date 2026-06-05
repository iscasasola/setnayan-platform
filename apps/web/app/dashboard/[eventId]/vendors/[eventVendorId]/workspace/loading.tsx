/**
 * Loading screen for the per-vendor workspace — the "dig deeper" target of a tap
 * on a vendor card in the Vendors tab (plan-budget-accordion.tsx).
 *
 * Owner 2026-06-05: "when we tap, the card enlarges to show that we are digging
 * deeper to that service. make sure to have a loading screen."
 *
 * Without this file the route inherited ../../../loading.tsx (the event-home
 * skeleton) — the wrong shape for a vendor detail page, so the drill-in flashed
 * a home-shaped skeleton. This centred spinner continues the same loading screen
 * the card-tap overlay shows on the Vendors tab (the .pbopen overlay), so the
 * hand-off from the tap animation to the route load is seamless. The gold ring
 * matches the overlay's spinner; --m-orange falls back to the Royal Champagne
 * Gold lock when the token is absent.
 */
export default function WorkspaceLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/15 border-t-[var(--m-orange,#C5A059)]" />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
        Opening service…
      </p>
    </div>
  );
}
