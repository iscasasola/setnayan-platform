import { loadHubDraftBarData } from '@/lib/hub-draft-store';
import { HubDraftToolbar } from './hub-draft-bar';

/**
 * THE ONE MOUNT for the Event Hub Maker's toolbar (Phase 2):
 *
 *   <MakerShell … applySlot={<HubDraftDock eventId={eventId} />}>
 *
 * A server component: it resolves the draft summary, the store-shell posture and
 * the live catalogue price (`loadHubDraftBarData`) once, and hands them to the
 * compact client toolbar (`HubDraftToolbar`), which reads the stage the couple
 * is on from the Maker's own state (`useMaker()`) for Reset. Everything it
 * prints comes from that one server read — no price is typed, and in the store
 * shell none is fetched.
 */
export async function HubDraftDock({ eventId }: { eventId: string }) {
  const bar = await loadHubDraftBarData(eventId);
  return <HubDraftToolbar {...bar} />;
}
