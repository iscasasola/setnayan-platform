/**
 * Loading screen for the per-vendor workspace — the "dig deeper" target of a tap
 * on a vendor card in the Vendors tab (plan-budget-accordion.tsx).
 *
 * Owner 2026-06-05: "when we tap, the card enlarges to show that we are digging
 * deeper to that service. make sure to have a loading screen" + "loading state
 * tells what we are doing." Unified onto the gold-particle brand loader
 * (owner 2026-07-05) — the same <SDLoader> mark used everywhere else; narration
 * lives in ROUTE_STEPS.workspace.
 */
import { SDLoader } from '@/components/sd-loader/sd-loader';
import { ROUTE_STEPS } from '@/components/sd-loader/loader-steps';

export default function WorkspaceLoading() {
  return (
    <div className="min-h-[60vh]">
      <SDLoader steps={ROUTE_STEPS.workspace.steps} hint={ROUTE_STEPS.workspace.hint} />
    </div>
  );
}
