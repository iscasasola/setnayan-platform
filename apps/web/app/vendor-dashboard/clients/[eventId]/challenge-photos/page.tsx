import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { partReadOutcome } from '@/lib/vendor-part-read';
import { readTheirEventName } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { ChallengePhotosBody, type ChallengeTile } from './challenge-photos-body';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { fetchVendorChallengePhotos } from '@/lib/papic-games';
import { displayChallengePrompt } from '@/lib/papic-missions';
import { resolveEventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { EventLockedPage } from '@/app/vendor-dashboard/_components/event-locked-by-fee';
import { vendorClientSurfaceHref } from '@/lib/vendor-client-return';
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';

export const metadata = { title: 'Challenge photos · Supplier' };
export const dynamic = 'force-dynamic';

// Papic Games — Phase 5: the sponsoring vendor collects the CONSENTED guest photos
// from their challenges. The RPC (papic_vendor_challenge_photos) is the gate —
// sponsored + consent_to_share + moderation clean + not hidden — and returns
// web-copy refs only; this page just presigns them (short TTL) into a grid.

type Tile = ChallengeTile;

export default async function VendorChallengePhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!papicGamesEnabled()) redirect(vendorClientSurfaceHref(eventId, 'brief', { shellOn: isRelationshipWorkspaceEnabled() }));

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // ── THE BOOKING FEE UNLOCKS THE EVENT (owner, 2026-09-20) ────────────────
  // A per-event workroom is item 1/5/6/7 of the ruling. Flag OFF ⇒ the stage is
  // always 'unlocked' and this is a no-op. Flag ON and the fee unsettled ⇒ a
  // PAGE that says the amount, the due date and where to pay — never a redirect
  // and never a 404.
  const feeGate = await resolveEventFeeGate(profile.vendor_profile_id, eventId);
  if (feeGate.stage !== 'unlocked') {
    return <EventLockedPage eventId={eventId} gate={feeGate} />;
  }

  // Booked-gate via the canonical vendor↔event brief RPC (also what the parent
  // client card uses); the photo RPC additionally requires a paid sponsorship.
  const [{ data: brief, error: briefErr }, eventName] = await Promise.all([
    supabase.rpc('get_vendor_event_brief', { p_event_id: eventId }),
    readTheirEventName(supabase, eventId),
  ]);
  // The brief's gates (not booked …) are an answer — back to Clients, as always. A brief that did not answer is SAID.
  const briefRead = partReadOutcome(briefErr, brief);
  if (briefRead === 'failed') {
    logQueryError('VendorChallengePhotos.brief', briefErr!, { eventId }, 'graceful_degrade');
    return <ChallengePhotosBody eventId={eventId} eventName={eventName} sections={null} />;
  }
  if (briefRead === 'gate') redirect('/vendor-dashboard/clients');

  // C-4: null = REFUSED (or thrown) — said, never "No shared photos yet".
  const photosRead = await fetchVendorChallengePhotos(supabase, eventId).catch(() => null);
  const photos = photosRead ?? [];

  // Group by challenge (mission), presigning each tile + open ref server-side.
  const groups = new Map<string, { prompt: string; tiles: Tile[] }>();
  for (const p of photos) {
    const isClip = p.media_type === 'clip';
    const tileRef = isClip
      ? (p.poster_r2_key ?? p.thumb_r2_key ?? p.display_r2_key)
      : (p.thumb_r2_key ?? p.display_r2_key);
    const openRef = isClip
      ? (p.clip_web_r2_key ?? p.display_r2_key ?? tileRef)
      : (p.display_r2_key ?? tileRef);
    const [tileUrl, openUrl] = await Promise.all([
      displayUrlForStoredAsset(tileRef, { ttlSeconds: 3600 }),
      displayUrlForStoredAsset(openRef, { ttlSeconds: 3600 }),
    ]);
    if (!tileUrl) continue; // no web copy → skip (never serve the raw original)
    const g = groups.get(p.mission_id) ?? { prompt: p.prompt, tiles: [] };
    g.tiles.push({ captureId: p.capture_id, isClip, tileUrl, openUrl: openUrl ?? tileUrl });
    groups.set(p.mission_id, g);
  }
  const sections = [...groups.values()];

  return (
    <ChallengePhotosBody
      eventId={eventId}
      eventName={eventName}
      sections={photosRead === null ? null : sections.map((sec) => ({ prompt: displayChallengePrompt(sec.prompt), tiles: sec.tiles }))}
    />
  );
}
