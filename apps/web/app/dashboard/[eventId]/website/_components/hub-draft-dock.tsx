import { loadHubDraftBarData } from '@/lib/hub-draft-store';
import { HubDraftBar, HubDraftReset } from './hub-draft-bar';
import type { HubResetScope } from '@/lib/hub-draft';

/**
 * THE ONE-LINE MOUNT for the Event Hub Maker shell (Phase 1):
 *
 *   <HubDraftDock eventId={eventId} stage="rsvp" />
 *
 * A server component: it resolves the draft summary, the store-shell posture and
 * the live catalogue price (`loadHubDraftBarData`) and renders the Apply ·
 * Restore bar (hidden while there is no draft) plus the always-reachable Reset
 * for the stage the Maker is showing. Everything it prints comes from that one
 * server read — no price is typed, and in the store shell none is fetched.
 */
export async function HubDraftDock({ eventId, stage }: { eventId: string; stage?: HubResetScope }) {
  const bar = await loadHubDraftBarData(eventId);
  return (
    <div className="flex flex-col gap-2">
      <HubDraftBar {...bar} />
      <HubDraftReset eventId={eventId} stage={stage} />
    </div>
  );
}
