import { createAdminClient } from '@/lib/supabase/admin';
import {
  getWallSnapshot,
  isWallSessionLive,
  readWallDisplayCookie,
} from '@/lib/live-wall';
import { WallClaim } from './_components/wall-claim';
import { WallProjection } from './_components/wall-projection';

// Salamisim · the Live Photo Wall venue projection (0012 · Phase 1).
//
// /wall/[eventId] — full-screen, no-chrome, anonymous. A venue screen lands
// here from the couple's "Open wall on a screen" QR/URL:
//   no display-session cookie  → the claim screen (type the 6-char code)
//   claimed + unrevoked        → the live projection (tiles via the service-
//                                role feed route; realtime nudge + reconcile)
//
// Dark-launch posture (P1): the page renders the claim screen only when the
// event actually owns the LIVE_WALL SKU — everyone else gets the quiet
// not-here card. FaceBlock events never emit wall_feed rows (fail-closed in
// wall_ingest + re-checked in the reader), so a claimed screen on such an
// event simply shows the waiting state.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function WallPage({ params }: Props) {
  const { eventId } = await params;

  // G0 at the door: no LIVE_WALL activation → a quiet dead end (no oracle
  // about whether the event exists).
  const admin = createAdminClient();
  const { data: activation } = await admin
    .from('event_software_activations_v2')
    .select('service_code')
    .eq('event_id', eventId)
    .eq('service_code', 'LIVE_WALL')
    .maybeSingle();

  if (!activation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-cream">
        <p className="text-sm text-cream/50">This wall isn&rsquo;t lit. Check the link with the couple.</p>
      </main>
    );
  }

  const session = await readWallDisplayCookie();
  const claimed =
    session?.event_id === eventId && (await isWallSessionLive(session));

  if (!claimed) {
    return <WallClaim eventId={eventId} />;
  }

  const snapshot = await getWallSnapshot(eventId);
  return <WallProjection eventId={eventId} initial={snapshot} />;
}
