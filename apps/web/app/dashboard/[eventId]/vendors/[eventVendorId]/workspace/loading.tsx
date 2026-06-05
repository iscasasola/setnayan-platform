/**
 * Loading screen for the per-vendor workspace — the "dig deeper" target of a tap
 * on a vendor card in the Vendors tab (plan-budget-accordion.tsx).
 *
 * Owner 2026-06-05: "when we tap, the card enlarges to show that we are digging
 * deeper to that service. make sure to have a loading screen" + "loading state
 * tells what we are doing."
 *
 * Without this file the route inherited the event-home skeleton (the wrong
 * shape). This centred spinner continues the loading screen the card-tap overlay
 * shows on the Vendors tab (the `.pbopen` overlay), and a cycling
 * <LoadingStatus> narrates the workspace load (conversation · payments ·
 * documents). The gold ring matches the overlay spinner; `--m-orange` falls back
 * to the Royal Champagne Gold lock when the token is absent.
 */
import { LoadingStatus } from '@/components/loading-status';

const WORKSPACE_MESSAGES = [
  'Opening the workspace…',
  'Loading messages & payments…',
  'Bringing in your documents…',
  'Almost there…',
];

export default function WorkspaceLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/15 border-t-[var(--m-orange,#C5A059)]" />
      <LoadingStatus
        className="text-[14.5px] font-semibold text-ink"
        messages={WORKSPACE_MESSAGES}
      />
    </div>
  );
}
